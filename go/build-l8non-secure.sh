#!/usr/bin/env bash
set -e

rm -rf go.sum
rm -rf go.mod
rm -rf vendor

go mod init
GOPROXY=direct GOPRIVATE=github.com go mod tidy
go mod vendor
cp ./vendor/github.com/saichler/l8utils/go/utils/resources/build-test-security.sh .
chmod +x ./build-test-security.sh
rm -rf vendor
./build-test-security.sh
rm -rf ./build-test-security.sh
go mod vendor

export pw1=$PWD
cd ./nas/web
mv ../../tests/loader.so .

go build -o fileManager
export pw=$PWD


zip -r fileManager.zip ./fileManager ./web ./loader.so
#scp fileManager.zip $1:/root/fileManager.zip
rm fileManager
rm loader.so

mv fileManager.zip $pw1/.
