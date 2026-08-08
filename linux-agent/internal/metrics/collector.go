package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/hasilan/node-deck/linux-agent/internal/config"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/sensors"
)

type Snapshot struct {
	Timestamp   time.Time      `json:"timestamp"`
	CPU         CPU            `json:"cpu"`
	Memory      Memory         `json:"memory"`
	Temperature []Temperature  `json:"temperature,omitempty"`
	Disks       []Disk         `json:"disks,omitempty"`
	Network     []Network      `json:"network,omitempty"`
	Services    []Service      `json:"services,omitempty"`
	Docker      []Container    `json:"docker,omitempty"`
	Custom      []CustomMetric `json:"custom,omitempty"`
}

type CPU struct {
	UsagePercent float64   `json:"usagePercent"`
	Cores        []float64 `json:"cores"`
}

type Memory struct {
	UsedBytes      uint64  `json:"usedBytes"`
	AvailableBytes uint64  `json:"availableBytes"`
	UsedPercent    float64 `json:"usedPercent"`
}

type Temperature struct {
	Sensor  string  `json:"sensor"`
	Celsius float64 `json:"celsius"`
}
type Disk struct {
	Mountpoint          string  `json:"mountpoint"`
	UsedBytes           uint64  `json:"usedBytes"`
	FreeBytes           uint64  `json:"freeBytes"`
	UsedPercent         float64 `json:"usedPercent"`
	ReadBytesPerSecond  float64 `json:"readBytesPerSecond"`
	WriteBytesPerSecond float64 `json:"writeBytesPerSecond"`
}
type Network struct {
	Interface        string  `json:"interface"`
	RxBytesPerSecond float64 `json:"rxBytesPerSecond"`
	TxBytesPerSecond float64 `json:"txBytesPerSecond"`
	RxBytes          uint64  `json:"rxBytes"`
	TxBytes          uint64  `json:"txBytes"`
}
type Service struct {
	Name        string `json:"name"`
	LoadState   string `json:"loadState"`
	ActiveState string `json:"activeState"`
	SubState    string `json:"subState"`
}
type Container struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	State            string  `json:"state"`
	CPUPercent       float64 `json:"cpuPercent,omitempty"`
	MemoryUsageBytes uint64  `json:"memoryUsageBytes,omitempty"`
	MemoryLimitBytes uint64  `json:"memoryLimitBytes,omitempty"`
}
type CustomMetric struct {
	ID            string     `json:"id"`
	Status        string     `json:"status"`
	Value         string     `json:"value,omitempty"`
	ExitCode      int        `json:"exitCode"`
	Stdout        string     `json:"stdout,omitempty"`
	Stderr        string     `json:"stderr,omitempty"`
	LastSuccessAt *time.Time `json:"lastSuccessAt,omitempty"`
}

type Collector struct {
	mu            sync.Mutex
	previous      time.Time
	disks         map[string]disk.IOCountersStat
	network       map[string]net.IOCountersStat
	services      []string
	docker        bool
	custom        map[string]config.CustomMetric
	customLast    map[string]time.Time
	customResults map[string]CustomMetric
}

func NewCollector(services []string, dockerEnabled bool, custom map[string]config.CustomMetric) Collector {
	return Collector{disks: make(map[string]disk.IOCountersStat), network: make(map[string]net.IOCountersStat), services: services, docker: dockerEnabled, custom: custom, customLast: make(map[string]time.Time), customResults: make(map[string]CustomMetric)}
}

func (c *Collector) Collect(ctx context.Context) (Snapshot, error) {
	usage, err := cpu.PercentWithContext(ctx, 0, false)
	if err != nil {
		return Snapshot{}, err
	}
	cores, err := cpu.PercentWithContext(ctx, 0, true)
	if err != nil {
		return Snapshot{}, err
	}
	memory, err := mem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return Snapshot{}, err
	}
	c.mu.Lock()
	disks, networks := c.collectDevices()
	temperatures := collectTemperatures()
	c.mu.Unlock()
	for index, core := range cores {
		cores[index] = finite(core)
	}
	return Snapshot{
		Timestamp:   time.Now().UTC(),
		CPU:         CPU{UsagePercent: finite(first(usage)), Cores: cores},
		Memory:      Memory{UsedBytes: memory.Used, AvailableBytes: memory.Available, UsedPercent: finite(memory.UsedPercent)},
		Temperature: temperatures, Disks: disks, Network: networks,
		Services: collectServices(ctx, c.services), Docker: collectDocker(ctx, c.docker), Custom: c.collectCustom(ctx, time.Now()),
	}, nil
}

func (c *Collector) collectCustom(parent context.Context, now time.Time) []CustomMetric {
	results := make([]CustomMetric, 0, len(c.custom))
	for id, definition := range c.custom {
		last := c.customLast[id]
		if !last.IsZero() && now.Sub(last) < definition.Interval {
			continue
		}
		result := runCustom(parent, id, definition)
		if previous, ok := c.customResults[id]; ok && result.LastSuccessAt == nil {
			result.LastSuccessAt = previous.LastSuccessAt
		}
		c.customResults[id] = result
		if result.LastSuccessAt != nil {
			c.customLast[id] = *result.LastSuccessAt
		} else {
			c.customLast[id] = now
		}
	}
	for _, result := range c.customResults {
		results = append(results, result)
	}
	return results
}

type cappedBuffer struct {
	bytes.Buffer
	limit    int
	exceeded bool
}

func (b *cappedBuffer) Write(data []byte) (int, error) {
	if b.Len()+len(data) > b.limit {
		b.exceeded = true
		remaining := b.limit - b.Len()
		if remaining > 0 {
			_, _ = b.Buffer.Write(data[:remaining])
		}
		return len(data), nil
	}
	return b.Buffer.Write(data)
}

func runCustom(parent context.Context, id string, definition config.CustomMetric) CustomMetric {
	result := CustomMetric{ID: id, Status: "error", ExitCode: -1}
	ctx, cancel := context.WithTimeout(parent, definition.Timeout)
	defer cancel()
	command := exec.CommandContext(ctx, definition.Command[0], definition.Command[1:]...)
	stdout := &cappedBuffer{limit: definition.MaxOutputBytes}
	stderr := &cappedBuffer{limit: definition.MaxOutputBytes}
	command.Stdout, command.Stderr = stdout, stderr
	err := command.Run()
	result.Stdout, result.Stderr = stdout.String(), stderr.String()
	if stdout.exceeded || stderr.exceeded {
		result.Status = "output_limit"
		return result
	}
	if ctx.Err() == context.DeadlineExceeded {
		result.Status = "timeout"
		return result
	}
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitError.ExitCode()
		}
		return result
	}
	result.Status, result.Value = "ok", strings.TrimSpace(result.Stdout)
	result.ExitCode = 0
	success := time.Now().UTC()
	result.LastSuccessAt = &success
	return result
}

func collectServices(parent context.Context, names []string) []Service {
	services := make([]Service, 0, len(names))
	for _, name := range names {
		if !validUnit(name) {
			continue
		}
		ctx, cancel := context.WithTimeout(parent, 2*time.Second)
		output, err := exec.CommandContext(ctx, "systemctl", "show", "--no-page", "--property=LoadState,ActiveState,SubState", name).Output()
		cancel()
		service := Service{Name: name}
		if err != nil {
			service.ActiveState = "unavailable"
			services = append(services, service)
			continue
		}
		for _, line := range strings.Split(string(output), "\n") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}
			switch parts[0] {
			case "LoadState":
				service.LoadState = parts[1]
			case "ActiveState":
				service.ActiveState = parts[1]
			case "SubState":
				service.SubState = parts[1]
			}
		}
		services = append(services, service)
	}
	return services
}

func collectDocker(parent context.Context, enabled bool) []Container {
	if !enabled {
		return nil
	}
	ctx, cancel := context.WithTimeout(parent, 2*time.Second)
	output, err := exec.CommandContext(ctx, "docker", "ps", "-a", "--format", "{{json .}}").Output()
	cancel()
	if err != nil {
		return nil
	}
	containers := make([]Container, 0)
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		if line == "" {
			continue
		}
		var item struct {
			ID    string `json:"ID"`
			Names string `json:"Names"`
			State string `json:"State"`
		}
		if json.Unmarshal([]byte(line), &item) == nil {
			containers = append(containers, Container{ID: item.ID, Name: item.Names, State: item.State})
		}
	}
	ctx, cancel = context.WithTimeout(parent, 2*time.Second)
	stats, err := exec.CommandContext(ctx, "docker", "stats", "--no-stream", "--format", "{{json .}}").Output()
	cancel()
	if err != nil {
		return containers
	}
	for _, line := range strings.Split(strings.TrimSpace(string(stats)), "\n") {
		var item struct {
			Name   string `json:"Name"`
			CPU    string `json:"CPUPerc"`
			Memory string `json:"MemUsage"`
		}
		if json.Unmarshal([]byte(line), &item) != nil {
			continue
		}
		for index, container := range containers {
			if container.Name == item.Name {
				containers[index].CPUPercent = parsePercent(item.CPU)
				memory, limit := parseMemoryPair(item.Memory)
				containers[index].MemoryUsageBytes, containers[index].MemoryLimitBytes = memory, limit
			}
		}
	}
	return containers
}

func parsePercent(value string) float64 {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(strings.TrimSuffix(value, "%")), 64)
	if err != nil {
		return 0
	}
	return finite(parsed)
}

func parseMemoryPair(value string) (uint64, uint64) {
	parts := strings.Split(value, " /")
	if len(parts) != 2 {
		return parseBytes(value), 0
	}
	return parseBytes(parts[0]), parseBytes(parts[1])
}

func parseBytes(value string) uint64 {
	fields := strings.Fields(strings.TrimSpace(value))
	if len(fields) == 0 {
		return 0
	}
	numberText := fields[0]
	unit := "B"
	if len(fields) > 1 {
		unit = fields[1]
	} else {
		upper := strings.ToUpper(numberText)
		for _, candidate := range []string{"GIB", "MIB", "KIB", "GB", "MB", "KB", "B"} {
			if strings.HasSuffix(upper, candidate) {
				unit = candidate
				numberText = numberText[:len(numberText)-len(candidate)]
				break
			}
		}
	}
	number, err := strconv.ParseFloat(numberText, 64)
	if err != nil {
		return 0
	}
	multiplier := float64(1)
	switch strings.ToUpper(unit) {
	case "KB", "KIB":
		multiplier = 1024
	case "MB", "MIB":
		multiplier = 1024 * 1024
	case "GB", "GIB":
		multiplier = 1024 * 1024 * 1024
	}
	if number < 0 {
		return 0
	}
	return uint64(number * multiplier)
}

func validUnit(name string) bool { return name != "" && !strings.ContainsAny(name, "\r\n;|&") }

func (c *Collector) collectDevices() ([]Disk, []Network) {
	now := time.Now()
	elapsed := now.Sub(c.previous).Seconds()
	if elapsed <= 0 {
		elapsed = 1
	}
	partitions, _ := disk.Partitions(false)
	diskStats, _ := disk.IOCounters()
	disks := make([]Disk, 0, len(partitions))
	for _, partition := range partitions {
		usage, err := disk.Usage(partition.Mountpoint)
		if err != nil {
			continue
		}
		stat, ok := diskStats[partition.Device]
		previous := c.disks[partition.Device]
		disks = append(disks, Disk{Mountpoint: partition.Mountpoint, UsedBytes: usage.Used, FreeBytes: usage.Free, UsedPercent: finite(usage.UsedPercent), ReadBytesPerSecond: rate(stat.ReadBytes, previous.ReadBytes, elapsed, ok), WriteBytesPerSecond: rate(stat.WriteBytes, previous.WriteBytes, elapsed, ok)})
		if ok {
			c.disks[partition.Device] = stat
		}
	}
	interfaces, _ := net.IOCounters(true)
	networks := make([]Network, 0, len(interfaces))
	for _, stat := range interfaces {
		previous := c.network[stat.Name]
		networks = append(networks, Network{Interface: stat.Name, RxBytesPerSecond: rate(stat.BytesRecv, previous.BytesRecv, elapsed, previous.Name != ""), TxBytesPerSecond: rate(stat.BytesSent, previous.BytesSent, elapsed, previous.Name != ""), RxBytes: stat.BytesRecv, TxBytes: stat.BytesSent})
		c.network[stat.Name] = stat
	}
	c.previous = now
	return disks, networks
}

func collectTemperatures() []Temperature {
	values, _ := sensors.SensorsTemperatures()
	temperatures := make([]Temperature, 0, len(values))
	for _, value := range values {
		temperatures = append(temperatures, Temperature{Sensor: value.SensorKey, Celsius: finite(value.Temperature)})
	}
	return temperatures
}

func rate(current, previous uint64, elapsed float64, valid bool) float64 {
	if !valid || current < previous {
		return 0
	}
	return float64(current-previous) / elapsed
}

func finite(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return value
}

func first(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return values[0]
}
