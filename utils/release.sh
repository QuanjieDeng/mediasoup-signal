#!/bin/bash


usage() {
cat << EOF
usage: $0  -v v1.0.2 -p v1.0.1

Creates a release
OPTIONS:
   -h      Show this message
   -v      Version (vX)
   -p      pre Version(vX)
EOF
}

while getopts “hv:p:” OPTION
do
  case $OPTION in
    h)
      usage
      exit
      ;;
    v)
      VERSION="$OPTARG"
      ;;
    p)
      PVERSION="$OPTARG"
      ;;
    ?)
      usage
      exit 1
      ;;
  esac
done

echo  $VERSION
echo  $PVERSION

if [ -z "$VERSION" ] || [ -z " $PVERSION" ]; then
  echo ERROR: Please provide -v  -p
  usage
  exit
fi


COMMIT=`git rev-list -n 1 HEAD`
LOGS=`git log $PVERSION..$COMMIT --oneline | perl -p -e 's/\n/\\\\n/' | sed -e s/\"//g`
echo  $LOGS


RELEASEMSG="### Detailed PR List:\\n $LOGS"
RELEASEMSG=`echo ${RELEASEMSG//\\\\n/"\r\n - "}`
# RELEASEMSG=`echo ${RELEASEMSG//\\\\n/"<br><br/>"}`
echo ${RELEASEMSG}


RELEASE_MAJOR=`echo "${VERSION}" | sed "s/v//g"`
WORKERDIR="MEDIASOUP_SIGNALE_RELEASEBUILD"
GIT_USER="dengquanjie"
GIT_PWD="QuanjieDeng%4011"
token="j-u8ZkAFK51XnWs_s61F"
DOCKER_USER="dengquanjie"
DOCKER_PASS="Ztgame%40123"
DOCKER_TAG=${RELEASE_MAJOR}
DOCKER_NAME="docker-registry.ztgame.com.cn/im/mediasoup-signal:${DOCKER_TAG}"
GITLAB_RELEASE_TAG="v${RELEASE_MAJOR}"
echo  "release_version:"${RELEASE_MAJOR}
echo  "docker_tag:"${DOCKER_TAG}
echo  "gitlab_release_tag:"${GITLAB_RELEASE_TAG}
echo  "dockerhub_name:"${DOCKER_NAME}

#build  images
rm -rf   ${WORKERDIR}
mkdir    ${WORKERDIR}
cd ${WORKERDIR}
git clone https://${GIT_USER}:${GIT_PWD}@git.devcloud.ztgame.com/realtimevoice/mediasoup-signal.git
cd mediasoup-signal
docker  build  -t    ${DOCKER_NAME} ./
rm -rf   ${WORKERDIR}

#create release tag whit gitlab  
curl --request POST --header "PRIVATE-TOKEN: $token"  "https://git.devcloud.ztgame.com//api/v4/projects/85/repository/tags?tag_name=$VERSION&ref=master"
echo "----------------------------------------------"

DOCKER_IMAGES_URL="https://docker-registry.ztgame.com.cn/harbor/projects/43/repositories/im%2Fmediasoup-signal/tags/"${RELEASE_MAJOR}
#创建 release 版本 
echo $RELEASEMSG

data='{ "name": "'$VERSION'", "tag_name": "'$VERSION'", "description": "'${RELEASEMSG}'" , "ref":"'$VERSION'" ,"assets": { "links": [{ "name": "Docker-images", "url": "'${DOCKER_IMAGES_URL}'" }] } }' 

curl   --header 'Content-Type: application/json' --header "PRIVATE-TOKEN: $token" --data "$data" --request POST  "https://git.devcloud.ztgame.com/api/v4/projects/85/releases"

# push docker image to hub
docker login -u ${DOCKER_USER} -p ${DOCKER_PASS}
docker push  ${DOCKER_NAME}
docker  rmi      ${DOCKER_NAME}
