package metrics

import (
	"context"
	"sync"
	"time"
)

type Store struct {
	mu       sync.RWMutex
	snapshot Snapshot
	ready    bool
}

func NewStore() *Store { return &Store{} }

func (s *Store) Run(ctx context.Context, collector Collector, interval time.Duration) {
	s.update(ctx, collector)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.update(ctx, collector)
		}
	}
}

func (s *Store) Snapshot() (Snapshot, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshot, s.ready
}

func (s *Store) update(ctx context.Context, collector Collector) {
	snapshot, err := collector.Collect(ctx)
	if err != nil {
		return
	}
	s.mu.Lock()
	s.snapshot = snapshot
	s.ready = true
	s.mu.Unlock()
}
