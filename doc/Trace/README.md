## 说明
- sky的存储方案有 mysql  h2  ES ,考虑到效率和持久化，这里选择ES  

## ES 
ES 也就是elasticsearch，因为要持久化，所以需要NFS服务，我们会通过挂载 volunme的方式去使用 
默认启动五个节点  3主2从
Master节点不存储数据，只用来进行协调 
### NFS 配置
在NFS服务器上创建两个共享文件夹 
/nfs_share/esmaster
/nfs_share/esdata
添加配置 在  /etc/exports 添加 
/nfs-share/esmaster *(rw,async,no_root_squash)
/nfs-share/esdata *(rw,async,no_root_squash)
让配置生效
exportfs -r

### 安装elsearch
- 需要注意的ES在配置文件中设置了node亲和性，只有具有标签  es:enable的node才会被选择部署，所以在部署之前需要选择合适的node
设置上相应的标签

- 被选为部署ES的node所在的主机，需要打开所有的限制 包括可能不限于
```
ulimit -n 65535
ulimit   -l  ulimited

```
- 然后开始部署流程
```
#创建 pv &pvc 
# 创建PV&PVC之前需要根据实际情况修改文件中NFS服务器地址 

kubectl  apply  -f     ./elasticsearch-pv.yaml   -n   ${NAMESPACE}

#创建ES & ES-SVC
kubectl  apply  -f    ./elasticsearch.yaml  -n   ${NAMESPACE}

```
## SkyAPM
SkyWalking的安装，我们采用官网提供的 helm的方式去安装,但是我们使用外部安装好的ES服务，这样方便数据落地，一体化安装的话，起码数据落地这块不好搞
https://github.com/apache/skywalking-kubernetes

```
git clone https://github.com/apache/skywalking-kubernetes
cd skywalking-kubernetes/chart
helm repo add elastic https://helm.elastic.co
helm dep up skywalking   
# 这一步会报错，因为官网的chart文件使用的是v2版本,但是我的 helm可能只支持v1,修改掉即可
export SKYWALKING_RELEASE_NAME=skywalking  
export SKYWALKING_RELEASE_NAMESPACE=skyapm


然后修改./skywalking/values-my-es.yaml 文件 
oap:
  image:
    tag: 8.1.0-es6      #这里是设定oap的镜像版本,具体的镜像版本 参考  https://hub.docker.com/r/apache/skywalking-oap-server
  storageType: elasticsearch   #这里设置存储类型 

ui:
  image:
    tag: 8.1.0     #这里设置ui的镜像版本tag

elasticsearch:
  enabled: false   #保持为false
  config:               # For users of an existing elasticsearch cluster,takes effect when `elasticsearch.enabled` is false
    host: elasticsearch-service   #这设置已经部署好的ES的信息，可以是域名或者是IP  
    port:
      http: 9200
    user: "xxx"         # [optional] es用户名   可选
    password: "xxx"     # [optional]  es密码    可选

然后执行  
# helm 4 
helm install "${SKYWALKING_RELEASE_NAME}" skywalking   --namespace="${SKYWALKING_RELEASE_NAMESPACE}"  -f ./skywalking/values-my-es.yaml
# helm 3
helm install  skywalking   --namespace="${SKYWALKING_RELEASE_NAMESPACE}"  -f ./skywalking/values-my-es.yaml
```