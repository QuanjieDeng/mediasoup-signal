#!/usr/bin/env bash
SCRIPT=`pwd`/$0
ROOT=/opt/mediasoup-signal
SCRIPTS="$ROOT"/scripts
BUILD_DIR="$ROOT"/build
DB_DIR="$BUILD_DIR"/db
EXTRAS="$ROOT"/extras
NVM_CHECK="$ROOT"/scripts/checkNvm.sh

parse_arguments(){
  if [ -z "$1" ]; then
    echo "No parameters -- starting everything"
    MONGODB=true
    RABBITMQ=true
    NUVE=true
    ERIZOCONTROLLER=true
    ERIZOAGENT=true
    ROV=true

  else
    while [ "$1" != "" ]; do
      case $1 in
        "--mongodb")
        MONGODB=true
        ;;
        "--rabbitmq")
        RABBITMQ=true
        ;;
        "--nuve")
        NUVE=true
        ;;
        "--erizoController")
        ERIZOCONTROLLER=true
        ;;
        "--erizoAgent")
        ERIZOAGENT=true
        ;;
        "--ROV")
        ROV=true
        ;;
      esac
      shift
    done
  fi
}

run_nvm() {
  echo "Running NVM"
  . $ROOT/build/libdeps/nvm/nvm.sh

}
check_result() {
  if [ "$1" -eq 1 ]
  then
    exit 1
  fi
}
run_rabbitmq() {
  echo "Starting Rabbitmq"
  rabbitmq-server -detached
  sleep 5
  rabbitmqctl add_user test 123456
  rabbitmqctl  set_user_tags  test  administrator
  rabbitmqctl set_permissions -p "/" test ".*" ".*" ".*"
  tail  -f  /var/log/rabbitmq/rabbit*.log
  
  sleep 3
}

run_mongo() {
  if ! pgrep mongod; then
    echo [mediasoup] Starting mongodb
    if [ ! -d "$DB_DIR" ]; then
      mkdir -p "$DB_DIR"/db
    fi
    mongod --repair --dbpath $DB_DIR
    mongod --nojournal --dbpath $DB_DIR --logpath $BUILD_DIR/mongo.log --fork
    sleep 5
  else
    echo [mediasoup] mongodb already running
  fi

  dbURL=`grep "config.nuve.dataBaseURL" $SCRIPTS/licode_default.js`

  dbURL=`echo $dbURL| cut -d'"' -f 2`
  dbURL=`echo $dbURL| cut -d'"' -f 1`

  echo [mediasoup] Creating superservice in $dbURL
  mongo $dbURL --eval "db.services.insert({name: 'superService', key: '$RANDOM', rooms: []})"
  SERVID=`mongo $dbURL --quiet --eval "db.services.findOne()._id"`
  SERVKEY=`mongo $dbURL --quiet --eval "db.services.findOne().key"`

  SERVID=`echo $SERVID| cut -d'"' -f 2`
  SERVID=`echo $SERVID| cut -d'"' -f 1`

  if [ -f "$BUILD_DIR/mongo.log" ]; then
    echo "Mongo Logs: "
    cat $BUILD_DIR/mongo.log
  fi

  echo [mediasoup] SuperService ID $SERVID
  echo [mediasoup] SuperService KEY $SERVKEY
  cd $BUILD_DIR
  replacement=s/_auto_generated_ID_/${SERVID}/
  sed $replacement $SCRIPTS/licode_default.js > $BUILD_DIR/licode_1.js
  replacement=s/_auto_generated_KEY_/${SERVKEY}/
  sed $replacement $BUILD_DIR/licode_1.js > $ROOT/licode_config.js
  rm $BUILD_DIR/licode_1.js

  tail   -f $BUILD_DIR/mongo.log
}
run_nuve() {
  echo "Starting Nuve"
  cd $ROOT/nuve/nuveAPI
  
  node nuve.js &
  sleep 5
}
run_erizoController() {
  echo "Starting erizoController"
  cd $ROOT/erizo_controller/erizoController
  node erizoController.js &
}
run_erizoAgent() {
  echo "Starting erizoAgent"
  cd $ROOT/erizo_controller/erizoAgent
  node erizoAgent.js &
}

run_ROV() {
  echo "String Rov"
  cd $ROOT/erizo_controller/ROV
  node rovMetricsServer.js &
}


parse_arguments $*

cd $ROOT/scripts

run_nvm
nvm use

if [ "$MONGODB" == "true" ]; then
  run_mongo
fi

if [ "$RABBITMQ" == "true" ]; then
  run_rabbitmq
fi

if [ ! -f "$ROOT"/licode_config.js ]; then
    cp "$SCRIPTS"/licode_default.js "$ROOT"/licode_config.js
fi


if [ "$NUVE" == "true" ]; then
  if [ $RABBITMQ_URL ]; then
    echo "config.rabbit.url = '$RABBITMQ_URL';" >> /opt/mediasoup-signal/licode_config.js
  fi

  if [ $MONGO_URL ]; then
    echo "config.nuve.dataBaseURL = '$MONGO_URL';" >> /opt/mediasoup-signal/licode_config.js
  fi
  run_nuve
fi

if [ "$ERIZOCONTROLLER" == "true" ]; then
  if [ $RABBITMQ_URL ]; then
    echo "config.rabbit.url = '$RABBITMQ_URL';" >> /opt/mediasoup-signal/licode_config.js
  fi

  if [ $PUBLIC_IP ]; then
    echo "config.erizoController.publicIP = '$PUBLIC_IP';" >> /opt/mediasoup-signal/licode_config.js
  fi

  if [ $WARING_N_ROOM ]; then
    echo "config.erizoController.warning_n_rooms = $WARING_N_ROOM;" >> /opt/mediasoup-signal/licode_config.js
  fi

  if [ $LIMIT_N_ROOM ]; then
    echo "config.erizoController.limit_n_rooms = $LIMIT_N_ROOM;" >> /opt/mediasoup-signal/licode_config.js
  fi

  run_erizoController
fi

if [ "$ERIZOAGENT" == "true" ]; then
  if [ $RABBITMQ_URL ]; then
    echo "config.rabbit.url = '$RABBITMQ_URL';" >> /opt/mediasoup-signal/licode_config.js
  fi
  if [ $PUBLIC_IP ]; then
    echo "config.erizoAgent.publicIP = '$PUBLIC_IP';" >> /opt/mediasoup-signal/licode_config.js
  fi

  if [ $RTCMINPORT ]; then
    echo "config.mediasoup.workerSettings.rtcMinPort = '$RTCMINPORT';" >> /opt/mediasoup-signal/licode_config.js
  fi
  if [ $RTCMAXPORT ]; then
    echo "config.mediasoup.workerSettings.rtcMaxPort = '$RTCMAXPORT';" >> /opt/mediasoup-signal/licode_config.js
  fi
  
  if [ $DEBUG ]; then
    export DEBUG="$DEBUG"
  else
    export DEBUG="mediasoup:WARN* mediasoup:ERROR*"
  fi
  
  run_erizoAgent
fi

if [ "$ROV" == "true" ];then
  if [ $RABBITMQ_URL ]; then
    echo "config.rabbit.url = '$RABBITMQ_URL';" >> /opt/mediasoup-signal/licode_config.js
  fi
  run_ROV
fi



wait
