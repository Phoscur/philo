APP_NAME=philo-optic
GO_VERSION=1.24

# Build arguments
# Pass these to go build: -ldflags "-X main.version=$(VERSION) -X main.commit=$(COMMIT)"

all: build

build:
	@echo "Building $(APP_NAME)..."
	GOOS=linux GOARCH=arm64 go build -o $(APP_NAME) .

run:
	@echo "Running $(APP_NAME)..."
	./$(APP_NAME)

clean:
	@echo "Cleaning up..."
	rm -f $(APP_NAME)

.PHONY: all build run clean
