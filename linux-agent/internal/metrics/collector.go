package metrics

import (
	"context"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/sensors"
)

type Snapshot struct {
	Timestamp   time.Time     `json:"timestamp"`
	CPU         CPU           `json:"cpu"`
	Memory      Memory        `json:"memory"`
	Temperature []Temperature `json:"temperature,omitempty"`
	Disks       []Disk        `json:"disks,omitempty"`
	Network     []Network     `json:"network,omitempty"`
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

type Collector struct {
	mu       sync.Mutex
	previous time.Time
	disks    map[string]disk.IOCountersStat
	network  map[string]net.IOCountersStat
}

func NewCollector() Collector {
	return Collector{disks: make(map[string]disk.IOCountersStat), network: make(map[string]net.IOCountersStat)}
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
	return Snapshot{
		Timestamp:   time.Now().UTC(),
		CPU:         CPU{UsagePercent: first(usage), Cores: cores},
		Memory:      Memory{UsedBytes: memory.Used, AvailableBytes: memory.Available, UsedPercent: memory.UsedPercent},
		Temperature: temperatures, Disks: disks, Network: networks,
	}, nil
}

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
		disks = append(disks, Disk{Mountpoint: partition.Mountpoint, UsedBytes: usage.Used, FreeBytes: usage.Free, UsedPercent: usage.UsedPercent, ReadBytesPerSecond: rate(stat.ReadBytes, previous.ReadBytes, elapsed, ok), WriteBytesPerSecond: rate(stat.WriteBytes, previous.WriteBytes, elapsed, ok)})
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
		temperatures = append(temperatures, Temperature{Sensor: value.SensorKey, Celsius: value.Temperature})
	}
	return temperatures
}

func rate(current, previous uint64, elapsed float64, valid bool) float64 {
	if !valid || current < previous {
		return 0
	}
	return float64(current-previous) / elapsed
}

func first(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return values[0]
}
