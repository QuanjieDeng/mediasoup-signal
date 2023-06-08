#! /bin/bash  


NAMESPACE=licode3



#Create Namespace  
kubectl   create  namespace  ${NAMESPACE}

#创建私有仓库secret
kubectl -n    ${NAMESPACE}  create secret docker-registry self-registry-key --docker-server=  --docker-username=   --docker-password=   --docker-email=

#Create  ConfigMap
kubectl     create   configmap   licode-config   --from-file=./conf      -n    ${NAMESPACE}

#Create  mongodb-pv
kubectl  apply  -f    ./mongodb-pv-licode.yaml

#Create Mongodb  
kubectl  apply  -f    ./mongodb-nfs.yaml    -n   ${NAMESPACE}

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
kubectl  apply  -f    ./nuve-service.yaml    -n   ${NAMESPACE}

#Create  nuve-ingress
kubectl  apply  -f    ./nuve-ingress.yaml    -n   ${NAMESPACE}

#Create  EC
kubectl  apply  -f    ./ec.yaml    -n   ${NAMESPACE}

#Create  EA+EJ
kubectl  apply  -f    ./ea.yaml    -n   ${NAMESPACE}
