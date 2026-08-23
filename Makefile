IMAGE ?= automates-mpi
PORT ?= 3000

.DEFAULT_GOAL := run

.PHONY: build run

build:
	docker build -t $(IMAGE) .

run: build
	docker run --rm --init -p $(PORT):3000 $(IMAGE)
