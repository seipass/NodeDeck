package server

import (
	"encoding/json"
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
	for {
		if err := connection.SetReadDeadline(time.Now().Add(45 * time.Second)); err != nil {
			return
		}
		var incoming message
		if err := connection.ReadJSON(&incoming); err != nil {
			return
		}
		if strings.EqualFold(incoming.Type, "ping") {
			_ = connection.WriteJSON(map[string]string{"type": "pong"})
			continue
		}
		if incoming.Type != "subscribe" {
			_ = connection.WriteJSON(map[string]string{"type": "error", "code": "INVALID_MESSAGE"})
			continue
		}
		if err := connection.SetReadDeadline(time.Time{}); err != nil {
			return
		}
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for range ticker.C {
			snapshot, ready := h.store.Snapshot()
			if !ready {
				continue
			}
			payload, marshalErr := json.Marshal(metricMessage{Type: "metrics", Protocol: "streamdeck-monitor", Version: 1, Timestamp: snapshot.Timestamp, Data: snapshot})
			if marshalErr != nil || connection.WriteMessage(websocket.TextMessage, payload) != nil {
				return
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
