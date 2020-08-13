## 各个节点部署的思路
-  nuve 是无状态的，可以使用k8s-service 类型为nodeport
-  mongodb 对外封装一个service pod之间直接使用域名进行沟通
-  rabbitmq 对外封装一个service pod之间直接使用域名进行沟通
-  EC 在集群内部是没有人连接他的 他是客户端直接连接，用户在哪个EC上是nuve分配的 所以不对他构建任何的service
   EC的连接地址 -是在配置文件中直接配置死  二是 配置网卡名称 从网卡上获取
   由于是在K8S环境中，容器的重启可能会换node节点 所以还是配置网卡比较好  有个要求是 机器的外网IP 统一配置相同的网卡名称  这样配置文件好管理

-  EA+EJ是绑定在一起的，理论上一个node 不可以部署多个EA,因为端口占用比较多 EA最终在流媒体数据交互时也时和客户端互通的，而且端口不一定 没办法创建servie，直接部署成pod即可


### 配置文件
### 环境变量
- licode的镜像中启动脚本 需要使用一些环境变量的配置，我们先在ConfigMap中创建好
然后在 创建 k8s负载时 直接使用ConfigMap

### 配置文件
- 通过文件创建ConfigMap的方式去创建一个配置文件


## 部署步骤
- 所有集群内的主机的外网网卡名称统一修改为eth0
- 修改start.sh中的  namespace
- 执行start.sh 等待执行完成即可

## 使用ingress
- 如果希望通过使用ingress的方式暴露服务，首先需要在K8S集群中部署Ingress  Controler，目前主流的有nginx-ingress/haproxy/istiso
- 为nuve的创建Ingress Resource,关联到nuve-service
- 修改  start-with-ingress.sh中ns即可   执行步骤已经整理在脚本中   需要注意的是使用ingress暴露服务我们使用的是 ClusterIP模式的Service

## 关于数据落地
- mongodb的数据落地有两种方式，一种是直接本地挂载的方式，但是K8S环境中pod的调用等情况会导致变化node,会有数据丢失、不同步的风险
- 第二种是使用外部存储服务，比如NFS服务，如果需要使用nfs服务，需要提前部署好NFS服务器,修改  mongodb-pv-licode.yaml中NFS服务器的信息，然后执行start.sh

## NFS服务器
- NFS对外公布的路径为 /nfs_mongodb    mongodb的挂载路径为  /nfs_mongodb/mongodb  注意需要配置模式为no_root_squash
