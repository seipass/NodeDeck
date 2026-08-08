package config

import (
	"errors"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Listen Listen        `yaml:"listen"`
	Token  string        `yaml:"token"`
	Update time.Duration `yaml:"update_interval"`
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
	return config, nil
}
