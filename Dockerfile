FROM ubuntu:16.04

MAINTAINER dengquanjie@giant.com


RUN apt-get update -y && apt-get upgrade -y
RUN apt-get install -y tzdata && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

WORKDIR /opt


# Download latest version of the code and install dependencies
RUN  apt-get update && apt-get install -y git wget curl
RUN  apt-get install  -y  python-pip python-dev build-essential
RUN  apt-get install  -y  python3-pip
RUN  apt-get remove  -y  python-pip python3-pip
COPY  ./get-pip.py     /op/mediasoup-signal/
RUN   python     /op/mediasoup-signal/get-pip.py
RUN   python3     /op/mediasoup-signal/get-pip.py



COPY .nvmrc package.json /opt/mediasoup-signal/

COPY scripts/installUbuntuDeps.sh scripts/checkNvm.sh  /opt/mediasoup-signal/scripts/

WORKDIR /opt/mediasoup-signal/scripts

RUN ./installUbuntuDeps.sh --cleanup --fast

WORKDIR /opt

COPY . /opt/mediasoup-signal

RUN  rm  -rf   /opt/mediasoup-signal/.git
RUN mkdir /opt/mediasoup-signal/.git

# Clone and install licode
WORKDIR /opt/mediasoup-signal/scripts

RUN ./installErizo.sh && \
    ./../nuve/installNuve.sh

WORKDIR /opt/mediasoup-signal

ARG COMMIT

RUN echo $COMMIT > RELEASE
RUN date --rfc-3339='seconds' >> RELEASE
RUN cat RELEASE

WORKDIR /opt

ENTRYPOINT ["./mediasoup-signal/extras/docker/initDockerLicode.sh"]
