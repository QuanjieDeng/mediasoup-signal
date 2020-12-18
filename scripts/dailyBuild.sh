#!/usr/bin/env bash

## 创建临时文件夹
WORKERDIR="MEDIASOUP_SIGNALE_DAILYBUILD"
GIT_USER="XXXXX"
GIT_PWD="XXXXXXX"
DOCKER_NAME="mediasoup-signal"
DOCKER_TAG="vv"

rm -rf   ${WORKERDIR}
mkdir      ${WORKERDIR}
cd ${WORKERDIR}
git clone https://${GIT_USER}:${GIT_PWD}@XXXXXXXXXXXX

cd mediasoup-signal
docker  build  -t  ${DOCKER_NAME}:${DOCKER_TAG}   ./


#TODO 推送到仓库

cd  ../../
rm -rf   ${WORKERDIR}
