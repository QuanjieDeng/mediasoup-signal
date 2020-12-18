## 简介

Loki是 Grafana Labs 团队最新的开源项目，是一个水平可扩展，高可用性，多租户的日志聚合系统。它的设计非常经济高效且易于操作，因为它不会为日志内容编制索引，而是为每个日志流编制一组标签。项目受 Prometheus 启发，官方的介绍就是：Like Prometheus, but for logs.，类似于 Prometheus 的日志系统。

github地址   https://github.com/grafana/loki

## 安装 
Loki组件主要分成两个部分 
loki主服务器，负责存储日志和处理查询 
promtail 是专为Loki定制的代理，负责收集日志并发送给loki

Loki提供了非常多的安装方式,具体的可以参考文档 ，这里介绍的是使用helm进行安装 

添加helm源
helm repo add loki https://grafana.github.io/loki/charts
helm repo update

安装默认配置 
helm upgrade --install loki loki/loki-stack  通过这种方式一次性就安装了  loki+promtail

## 配置 
- loki的配置文件在cmd/loki文件夹下面,有两个配置文件 
```
loki-local-config.yaml   主要用来做本地部署时使用 
loki-docker-config.yaml   主要时作为容器启动时使用 

```

- promtail的配置在cmd/promtail，同样也是有两个配置文件
```
promtail-docker-config.yaml
promtail-local-config.yaml
```
所有的配置项都是可以直接通过启动参数设置的，这个根据需要

## 关于node亲和性 
这里为什么要说亲和性，因为 promtail在K8S中的部署类型为 DaemoSet，这意味这他会在集群的所有node中启动,
在实际的情况可能不是这样，我们如果使用公司的K8S集群，不需要在所有的node都部署，只需要在我们相关联的node上启动即可，

这时候就可以使用严格的node亲和性，保证只在相关的node上启动 