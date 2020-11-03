## 部署步骤
- 指标数据的搜集分成三个部分   rov  prometheus  grafana
- 下面记录在K8S集群中 这个三个部分的部署步骤,所有的部署yml文件都在k8s文件夹下  
## ROV
```
#Create    rov-service
kubectl  apply  -f   ./rov-service.yaml    -n   ${NAMESPACE}

#Create  rov
kubectl  apply  -f    ./rov.yaml    -n   ${NAMESPACE}

```


## Prometheus
```
#创建configmap
#这里直接使用文件夹的方式去创建 confimap
kubectl     create   configmap    prometheus-config   --from-file=./prome_conf/prometheus.yml      -n    ${NAMESPACE}
kubectl     create   configmap    alertmanager-config   --from-file=./prome_conf/alertmanager.yml      -n    ${NAMESPACE}
kubectl     create   configmap    prometheus-rule-config   --from-file=./prome_conf/rule     -n    ${NAMESPACE}

#创建prometheus-svc
kubectl  apply  -f    ./prometheus-svc.yaml    -n   ${NAMESPACE}

#创建prometheus
kubectl  apply  -f    ./prometheus.yaml    -n   ${NAMESPACE}

#创建alertmanager-svc
kubectl  apply  -f    ./prome-alertmanager-svc.yaml    -n   ${NAMESPACE}

#创建alertmanager
kubectl  apply  -f    ./prome-alertmanager.yaml    -n   ${NAMESPACE}

```


## Grafana
- grafana的部署相对比较麻烦的一点是 需要部署一个nfs服务器
```
#创建pv&pvc
kubectl  apply  -f    ./grafana-pv.yaml   -n  ${NAMESPACE}

#创建  grafana
kubectl  apply  -f    ./grafana.yaml    -n   ${NAMESPACE}

#创建  grafana-svc

kubectl  apply  -f    ./grafana-svc.yaml    -n   ${NAMESPACE}

```