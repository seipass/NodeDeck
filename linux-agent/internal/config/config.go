package config

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Listen        Listen                  `yaml:"listen"`
	Token         string                  `yaml:"token"`
	Update        time.Duration           `yaml:"update_interval"`
	Services      []string                `yaml:"services"`
	Docker        bool                    `yaml:"docker"`
	CustomMetrics map[string]CustomMetric `yaml:"custom_metrics"`
	TLS           TLS                     `yaml:"tls"`
}

type TLS struct {
	CertFile string `yaml:"cert_file"`
	KeyFile  string `yaml:"key_file"`
}

type CustomMetric struct {
	Command        []string      `yaml:"command"`
	Interval       time.Duration `yaml:"interval"`
	Timeout        time.Duration `yaml:"timeout"`
	MaxOutputBytes int           `yaml:"max_output_bytes"`
}

type Listen struct {
	Host string `yaml:"host"`
	Port string `yaml:"port"`
}

func Defaults() Config {
	return Config{Listen: Listen{Host: "0.0.0.0", Port: "8765"}, Update: time.Second}
}

func Load(path string) (Config, error) {
	config := Defaults()
	contents, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	if err := yaml.Unmarshal(contents, &config); err != nil {
		return Config{}, err
	}
	if config.Token == "" {
		return Config{}, errors.New("token is required")
	}
	if config.Listen.Port == "" {
		return Config{}, errors.New("listen.port is required")
	}
	if config.Update <= 0 {
		return Config{}, errors.New("update_interval must be positive")
	}
	if (config.TLS.CertFile == "") != (config.TLS.KeyFile == "") {
		return Config{}, errors.New("tls.cert_file and tls.key_file must be configured together")
	}
	for name, metric := range config.CustomMetrics {
		if strings.TrimSpace(name) == "" || len(metric.Command) == 0 || !filepath.IsAbs(metric.Command[0]) || metric.Timeout <= 0 || metric.Interval <= 0 {
			return Config{}, errors.New("invalid custom metric: " + name)
		}
		if metric.MaxOutputBytes <= 0 {
			config.CustomMetrics[name] = CustomMetric{Command: metric.Command, Interval: metric.Interval, Timeout: metric.Timeout, MaxOutputBytes: 65536}
		}
	}
	return config, nil
}
