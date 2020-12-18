#!/bin/bash
# count=`netstat    -anp |  grep  -w 8080|wc| awk  '{print $1-1}'`

# num=0

# while (( $count !=  0))
# do
#         echo "sleep socket  count:"$count
#         sleep 10
#         num=($num+1)
#         if (( $num == 3 ))
#         then
#             break
#         fi
#         count=`netstat    -anp |  grep -w   8080|wc| awk  '{print $1-1}'`
# done
# exit 0

pid=`ps  -ef |   grep      node    |   grep   -w    erizoController.js    |   awk  '{print $2}'`
kill   -15   $pid
exit 0

