package metrics

import (
	"context"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
)

type Snapshot struct {
	Timestamp time.Time `json:"timestamp"`
	CPU       CPU       `json:"cpu"`
	Memory    Memory    `json:"memory"`
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

type Collector struct{}

func NewCollector() Collector { return Collector{} }

func (Collector) Collect(ctx context.Context) (Snapshot, error) {
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
	return Snapshot{
		Timestamp: time.Now().UTC(),
		CPU:       CPU{UsagePercent: first(usage), Cores: cores},
		Memory:    Memory{UsedBytes: memory.Used, AvailableBytes: memory.Available, UsedPercent: memory.UsedPercent},
	}, nil
}

func first(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return values[0]
}
