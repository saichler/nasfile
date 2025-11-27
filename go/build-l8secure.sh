#!/usr/bin/env bash
set -e

rm -rf go.sum
rm -rf go.mod
rm -rf vendor

go mod init
GOPROXY=direct GOPRIVATE=github.com go mod tidy
go mod vendor

export pw=$PWD
cd ./nas/web

go build -o fileManager
cp /var/loader.so .

zip -r fileManager.zip ./fileManager ./web ./loader.so
rm fileManager
rm loader.so

scp fileManager.zip $1:/root/fileManager.zip

mv fileManager.zip ~/.
