APP_NAME=philo-optic
GO_VERSION=1.24

# Build arguments
# Pass these to go build: -ldflags "-X main.version=$(VERSION) -X main.commit=$(COMMIT)"

all: build

# Cross-compile the static binary for the Raspberry Pi (arm64).
build:
	@echo "Building $(APP_NAME) for linux/arm64..."
	GOOS=linux GOARCH=arm64 go build -o $(APP_NAME) .

run:
	@echo "Running $(APP_NAME)..."
	./$(APP_NAME)

# Run natively against a synthetic camera - no Pi/rpicam needed (dev + CI).
mock:
	@echo "Running $(APP_NAME) in mock mode on :$(PORT)..."
	PHILO_MODE=mock go run .

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

clean:
	@echo "Cleaning up..."
	rm -f $(APP_NAME)

PORT ?= 8080
.PHONY: all build run mock test vet fmt clean
