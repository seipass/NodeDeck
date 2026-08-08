package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hasilan/node-deck/linux-agent/internal/metrics"
	"github.com/hasilan/node-deck/linux-agent/internal/server"
)

func main() {
	if err := run(); err != nil {
		slog.Error("agent stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	port := flag.String("port", "8765", "WebSocket listen port")
	token := flag.String("token", "", "authentication token")
	interval := flag.Duration("interval", time.Second, "metric collection interval")
	flag.Parse()
	if *token == "" {
		return errors.New("token is required")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	collector := metrics.NewCollector()
	store := metrics.NewStore()
	go store.Run(ctx, collector, *interval)

	handler := server.NewHandler(store, *token)
	server := &http.Server{Addr: ":" + *port, Handler: handler}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	slog.Info("agent listening", "port", *port, "interval", *interval)
	err := server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
