package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hasilan/node-deck/linux-agent/internal/metrics"
)

type Handler struct {
	store    *metrics.Store
	token    string
	upgrader websocket.Upgrader
}

func NewHandler(store *metrics.Store, token string) http.Handler {
	return Handler{store: store, token: token, upgrader: websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}}
}

type message struct {
	Type     string   `json:"type"`
	Protocol string   `json:"protocol"`
	Version  int      `json:"version"`
	Token    string   `json:"token"`
	Metrics  []string `json:"metrics"`
}

func (h Handler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/ws" {
		http.NotFound(response, request)
		return
	}
	connection, err := h.upgrader.Upgrade(response, request, nil)
	if err != nil {
		return
	}
	defer connection.Close()
	connection.SetReadLimit(1 << 20)
	var hello message
	if err := connection.ReadJSON(&hello); err != nil || hello.Type != "hello" || hello.Token != h.token || hello.Version != 1 {
		_ = connection.WriteJSON(map[string]string{"type": "error", "code": "AUTH_FAILED"})
		return
	}
	if err := connection.WriteJSON(helloAck{Type: "hello_ack", Protocol: "streamdeck-monitor", Version: 1, Capabilities: []string{"cpu", "memory", "temperature", "disk", "network"}}); err != nil {
		return
	}
	if err := h.runSession(connection); err != nil {
		slog.Error("websocket session ended", "error", err)
	}
}

func (h Handler) runSession(connection *websocket.Conn) error {
	incoming := make(chan message, 4)
	errors := make(chan error, 1)
	done := make(chan struct{})
	defer close(done)
	go func() {
		for {
			var next message
			if err := connection.ReadJSON(&next); err != nil {
				select {
				case errors <- err:
				case <-done:
				}
				return
			}
			select {
			case incoming <- next:
			case <-done:
				return
			}
		}
	}()

	metricsTicker := time.NewTicker(time.Second)
	defer metricsTicker.Stop()
	heartbeatTicker := time.NewTicker(15 * time.Second)
	defer heartbeatTicker.Stop()
	subscribed := false
	for {
		select {
		case err := <-errors:
			return err
		case next := <-incoming:
			switch {
			case strings.EqualFold(next.Type, "ping"):
				if err := connection.WriteJSON(map[string]string{"type": "pong"}); err != nil {
					return err
				}
			case next.Type == "subscribe":
				subscribed = true
			case next.Type != "":
				if err := connection.WriteJSON(map[string]string{"type": "error", "code": "INVALID_MESSAGE"}); err != nil {
					return err
				}
			}
		case <-metricsTicker.C:
			if !subscribed {
				continue
			}
			snapshot, ready := h.store.Snapshot()
			if !ready {
				continue
			}
			payload, err := json.Marshal(metricMessage{Type: "metrics", Protocol: "streamdeck-monitor", Version: 1, Timestamp: snapshot.Timestamp, Data: snapshot})
			if err != nil {
				return err
			}
			if err := connection.WriteMessage(websocket.TextMessage, payload); err != nil {
				return err
			}
		case <-heartbeatTicker.C:
			if err := connection.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
				return err
			}
		}
	}
}

type helloAck struct {
	Type         string   `json:"type"`
	Protocol     string   `json:"protocol"`
	Version      int      `json:"version"`
	Capabilities []string `json:"capabilities"`
}

type metricMessage struct {
	Type      string           `json:"type"`
	Protocol  string           `json:"protocol"`
	Version   int              `json:"version"`
	Timestamp time.Time        `json:"timestamp"`
	Data      metrics.Snapshot `json:"data"`
}
