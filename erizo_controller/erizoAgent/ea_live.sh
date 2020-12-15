#!/bin/bash
num=`ps -ef | grep mediasoup-worker | grep -v grep | wc | awk '{print $1}'`
if [ $num -eq 0 ];then
    exit 1
fi
exit 0
