#!/bin/bash
# count=`curl  http://127.0.0.1:4000/roomsize`
# echo  $count

# while (( $count !=  0))
# do
#         echo "sleep room size:"$count
#         sleep 10
#         count=`curl  http://127.0.0.1:4000/roomsize`
# done
# exit 0


pid=`ps  -ef |   grep      node    |   grep   -w    erizoAgent.js    |   awk  '{print $2}'`
kill   -15   $pid
exit 0