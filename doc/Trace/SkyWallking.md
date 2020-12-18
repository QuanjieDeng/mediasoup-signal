## 简介
- skywalking 是由华为员工开源的一个APM系统，包含了所有的APM应该拥有的特性

- github地址  https://github.com/apache/skywalking
- 安装文档 
https://github.com/apache/skywalking/blob/v8.1.0/docs/README.md

- 中文文档 
https://github.com/apache/skywalking/blob/5.x/docs/README_ZH.md


## 安装

### 安装 elasticsearch
默认使用的存储类型为  elasticsearch

官网地址 https://www.elastic.co/guide/index.html
修改配置 然后启动 

###  安装skywalking
下载服务端包
http://skywalking.apache.org/downloads/

这里我是下载的  8.1.0 编译好的包
解压后
bin目录下是各种启动脚本
config目录是一些配置文件 修改配置

./bin/oapService.sh    
提示启动成功

/bin/webappService.sh 启动UI
UI的配置文件为 webapp/webapp.yml
提示启动成功
http://192.168.94.141:8090/ 我们就可以看到UI界面了 

### 客户端-agent

客户端支持很多种语言 可以参考地址 https://github.com/apache/skywalking/blob/v8.1.0/docs/en/setup/README.md
我这里使用的是NODEJS
nodejs客户端https://github.com/apache/skywalking-nodejs

### skyapm-nodejs的认证
skyapm的认证仅仅是基于token的认证，也就是简单通过比较字符串的值
服务器需要通过   application.yaml
receiver-sharing-server:
  default:
    authentication: ${SW_AUTHENTICATION:""}   //通过该字段进行设置

客户端在初始化本地的agent时进行设置相同的 token字段即可

## 数据存储
SkyWallking提供三种方式的存储，h2/mysql/ES
- h2是内存数据库，不适合真正线上的环境
- mysql和ES虽然都有数据落地，但是ES的速度较快，这个看实际的需要
下面分别记录三种存储的配置

### H2
- h2是默认的选择项，基本不要什么配置
```
  h2:
    driver: ${SW_STORAGE_H2_DRIVER:org.h2.jdbcx.JdbcDataSource}
    url: ${SW_STORAGE_H2_URL:jdbc:h2:mem:skywalking-oap-db}
    user: ${SW_STORAGE_H2_USER:sa}
    metadataQueryMaxSize: ${SW_STORAGE_H2_QUERY_MAX_SIZE:5000}
```

### mysql
- 修改 storage.selector  配置项为 ${SW_STORAGE:mysql}
- 修改mysql的配置项：
```
jdbcUrl: ${SW_JDBC_URL:"jdbc:mysql://localhost:3306/swtest"}    //连接地址
dataSource.user: ${SW_DATA_SOURCE_USER:root}    //用户名
dataSource.password: ${SW_DATA_SOURCE_PASSWORD:root@1234} //密码
```
