#! /bin/bash  


NAMESPACE=licode3

#Create Namespace  
kubectl   create  namespace  ${NAMESPACE}

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

#Create RabbitMQ-USER
sleep  10
rabbitmqPodName=`kubectl get pods    -o=name     -n    ${NAMESPACE}    | sed "s/^.\{4\}//" |   grep  rabbit `
kubectl exec -it ${rabbitmqPodName} -c rabbitmq  -n   ${NAMESPACE} -- rabbitmqctl add_user test 123456
kubectl exec -it ${rabbitmqPodName} -c rabbitmq  -n   ${NAMESPACE} -- rabbitmqctl  set_user_tags  test  administrator
kubectl exec -it ${rabbitmqPodName} -c rabbitmq  -n   ${NAMESPACE} -- rabbitmqctl set_permissions -p "/" test ".*" ".*" ".*"
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
