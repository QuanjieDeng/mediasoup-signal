#! /bin/bash  


NAMESPACE=200008-im


#Create Namespace  
kubectl   create  namespace  ${NAMESPACE}

#创建私有仓库secret
kubectl -n    ${NAMESPACE}  create secret docker-registry gianthub-registry-key --docker-server=docker-registry.ztgame.com.cn  --docker-username=dengquanjie   --docker-password=Ztgame@123   --docker-email=dengquanjie@ztgame.com

#Create  ConfigMap
kubectl     create   configmap   licode-config   --from-file=./conf      -n    ${NAMESPACE}

#Create Mongodb  
kubectl  apply  -f    ./mongodb.yaml    -n   ${NAMESPACE}

#Create  Mongodb-service
kubectl  apply  -f    ./mongodb-service.yaml    -n   ${NAMESPACE}

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
