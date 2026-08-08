package server

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hasilan/node-deck/linux-agent/internal/metrics"
)

func TestHandlerPushesMetricsAfterSubscribe(t *testing.T) {
	store := metrics.NewStore()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go store.Run(ctx, metrics.NewCollector(nil, false, nil), 50*time.Millisecond)
	server := httptest.NewServer(NewHandler(store, "secret", "cpu", "memory"))
	defer server.Close()
	url := "ws" + server.URL[len("http"):] + "/ws"
	connection, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	if err := connection.WriteJSON(message{Type: "hello", Protocol: "streamdeck-monitor", Version: 1, Token: "secret"}); err != nil {
		t.Fatal(err)
	}
	var ack helloAck
	if err := connection.ReadJSON(&ack); err != nil {
		t.Fatal(err)
	}
	if ack.Type != "hello_ack" {
		t.Fatalf("ack type = %q", ack.Type)
	}
	if len(ack.Capabilities) != 2 || ack.Capabilities[0] != "cpu" || ack.Capabilities[1] != "memory" {
		t.Fatalf("unexpected capabilities: %+v", ack.Capabilities)
	}
	if err := connection.WriteJSON(message{Type: "subscribe", Metrics: []string{"cpu"}}); err != nil {
		t.Fatal(err)
	}
	if err := connection.WriteJSON(message{Type: "ping"}); err != nil {
		t.Fatal(err)
	}
	if err := connection.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatal(err)
	}
	var pong struct {
		Type string `json:"type"`
	}
	for pong.Type != "pong" {
		if err := connection.ReadJSON(&pong); err != nil {
			t.Fatal(err)
		}
	}
	if err := connection.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatal(err)
	}
	var update metricMessage
	if err := connection.ReadJSON(&update); err != nil {
		t.Fatal(err)
	}
	if update.Type != "metrics" || update.Data.Timestamp.IsZero() {
		t.Fatalf("unexpected update: %+v", update)
	}
	if len(update.Data.Temperature) != 0 || len(update.Data.Disks) != 0 || len(update.Data.Network) != 0 {
		t.Fatalf("optional metrics were not filtered: %+v", update.Data)
	}
}

func TestSelectMetricsRejectsUnknownMetric(t *testing.T) {
	if _, valid := selectMetrics([]string{"cpu", "unknown"}, []string{"cpu", "memory"}); valid {
		t.Fatal("unknown metric was accepted")
	}
}

func TestSelectMetricsRejectsUnavailableMetric(t *testing.T) {
	if _, valid := selectMetrics([]string{"docker"}, []string{"cpu", "memory"}); valid {
		t.Fatal("unavailable metric was accepted")
	}
}

func TestHandlerRejectsWrongProtocol(t *testing.T) {
	server := httptest.NewServer(NewHandler(metrics.NewStore(), "secret"))
	defer server.Close()
	url := "ws" + server.URL[len("http"):] + "/ws"
	connection, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	if err := connection.WriteJSON(message{Type: "hello", Protocol: "other-protocol", Version: 1, Token: "secret"}); err != nil {
		t.Fatal(err)
	}
	var response struct {
		Type string `json:"type"`
		Code string `json:"code"`
	}
	if err := connection.ReadJSON(&response); err != nil {
		t.Fatal(err)
	}
	if response.Type != "error" || response.Code != "AUTH_FAILED" {
		t.Fatalf("unexpected response: %+v", response)
	}
}
