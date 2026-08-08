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

	"github.com/hasilan/node-deck/linux-agent/internal/config"
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
	configPath := flag.String("config", "", "YAML configuration path")
	port := flag.String("port", "", "override WebSocket listen port")
	token := flag.String("token", "", "override authentication token")
	interval := flag.Duration("interval", 0, "override metric collection interval")
	flag.Parse()
	settings := config.Defaults()
	if *configPath != "" {
		loaded, err := config.Load(*configPath)
		if err != nil {
			return err
		}
		settings = loaded
	}
	if *port != "" {
		settings.Listen.Port = *port
	}
	if *token != "" {
		settings.Token = *token
	}
	if *interval > 0 {
		settings.Update = *interval
	}
	if settings.Token == "" {
		return errors.New("token is required")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	collector := metrics.NewCollector(settings.Services, settings.Docker, settings.CustomMetrics)
	store := metrics.NewStore()
	go store.Run(ctx, collector, settings.Update)

	handler := server.NewHandler(store, settings.Token)
	server := &http.Server{Addr: settings.Listen.Host + ":" + settings.Listen.Port, Handler: handler}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	slog.Info("agent listening", "port", settings.Listen.Port, "interval", settings.Update)
	err := server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
