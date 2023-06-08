#! /bin/bash  


NAMESPACE=200008-im


#Create Namespace  
kubectl   create  namespace  ${NAMESPACE}

#创建私有仓库secret
kubectl -n    ${NAMESPACE}  create secret docker-registry self-registry-key --docker-server=  --docker-username=   --docker-password=   --docker-email=



#Create Mongodb  
kubectl  apply  -f    ./mongodb.yaml    -n   ${NAMESPACE}

#Create  Mongodb-service
kubectl  apply  -f    ./mongodb-service.yaml    -n   ${NAMESPACE}

#==================
#创建superservice 
# mongo $dbURL --eval "db.services.insert({name: 'superService', key: '$RANDOM', rooms: []})"
# SERVID=`mongo $dbURL --quiet --eval "db.services.findOne()._id"`
# SERVKEY=`mongo $dbURL --quiet --eval "db.services.findOne().key"`
#==================
#Create  ConfigMap
kubectl     create   configmap   licode-config   --from-file=./conf      -n    ${NAMESPACE}


#Create   RabbitMQ
kubectl  apply  -f    ./rabbitmq.yaml    -n   ${NAMESPACE}

#Create   RabbitMQ-service
kubectl  apply  -f    ./rabbitmq-service.yaml  -n   ${NAMESPACE}

#Create   RabbitMQ-service
kubectl  apply  -f    ./rabbitmqadmin-service.yaml  -n   ${NAMESPACE}

#Create  nuve
kubectl  apply  -f    ./nuve.yaml    -n   ${NAMESPACE}

#Create  nuve-serice
kubectl  apply  -f    ./nuve-service-clusterip.yaml    -n   ${NAMESPACE}

#Create  EC
kubectl  apply  -f    ./ec.yaml    -n   ${NAMESPACE}

#Create  EA+EJ
kubectl  apply  -f    ./ea.yaml    -n   ${NAMESPACE}
