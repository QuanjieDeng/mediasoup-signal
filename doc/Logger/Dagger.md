Dagger 是一个基于 Loki 的日志查询和管理系统，它是由达闼科技（ CloudMinds 云团队的大禹基础设施平台派生出来的一个项目。Dagger 运行在 Loki 前端，具备日志查询、搜索，保存和下载等特性，适用于云原生场景下的容器日志管理场景。

github地址
https://github.com/CloudmindsRobot/dagger



安装
前置条件 
- 一个完全可用的 K8S环境 
- 部署了完整的  Loki  
	loki的部署文档可以参考相关文档

下载源码 git clone https://github.com/CloudmindsRobot/dagger.git
源码中的 kubernetes/quickstart.yaml 是用来部署的K8S  配置文件
修改Loki源地址 

```
- name: LOKI_SERVER
  value: http://loki.infra:3100
```

另外配置文件中 还使用了PVC 
```
          volumeMounts:
            - mountPath: /usr/src/app/static
              name: static-data
            - mountPath: /usr/src/app/db
              name: sqlite-data
            - mountPath: /etc/dagger
              name: dagger-conf
      restartPolicy: Always
      serviceAccountName: ""
      volumes:
        - name: static-data
          persistentVolumeClaim:
            claimName: static-data
        - name: sqlite-data
          persistentVolumeClaim:
            claimName: sqlite-data
        - name: dagger-conf
          configMap:
            defaultMode: 420
            name: dagger-conf
```
在实际的部署时最好有单独的FS服务，事先创建好PVC
在测试时如果没有PVC可以暂时使用 挂载宿主机的方式，如下 
```
          volumeMounts:
            - mountPath: /usr/src/app/static
              name: static-data
            - mountPath: /usr/src/app/db
              name: sqlite-data
            - mountPath: /etc/dagger
              name: dagger-conf
      restartPolicy: Always
      serviceAccountName: ""
      volumes:
        - name: static-data
          hostPath:
            path: /tmp/static-data
        - name: sqlite-data
          hostPath:
            path: /tmp/sqlite-data
        - name: dagger-conf
          configMap:
            defaultMode: 420
            name: dagger-conf
```
然后创建NS  
kubectl  create  ns   Dagger  
部署
kubectl apply -f kubernetes/quickstart.yaml -n  Dagger

部署成功之后，我们可以通过  dagger-ui 这个SVC 进行访问 
默认创建的 dagger-ui是clusterIP模式，需要配合ingress使用，在测试时也可直接调整为 NodePort方式 
部署完毕 
使用说明，可以直接参考github项目主页的说明文档 