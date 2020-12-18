## 简介
-Grafana为开源组件，负责从Prometheus中拉取数据，进行展示 

Grafana的安装比较简单
首先使用docker启动,容器内服务监听在3000
docker  run   -p   3000:3000   grafana/grafana    

添加数据源 
	configuration--->data source  -->    prometheus  
	填写prometheus的监听地址
认证
	默认安装后用户名和密码都是admin  需要修改
报警
	通知通道
		设置通知的途径 email/webhook等等
		如果为email,还需要设置SMTP服务器
	报警规则
		检测周期--多久检测一次
		触发条件 
	通知内容
		通知的正文
		
		
		
报警emial配置
smtp]
enabled = true  #开户email发送配置
host = smtp.xxx.com:25  #此处需要加上端口号
user =username@xxx.com  #邮箱账号
# If the password contains # or ; you have to wrap it with triple quotes. Ex """#password;"""
password =1234567890    #邮箱密码
cert_file =
key_file =
skip_verify = true    #跳过校验
from_address = admin@grafana.localhost
from_name = Grafana
ehlo_identity =

报警webhook配置
该配置比较简单，需要你自己提供一个 POST或者是PUT接口，在创建通知渠道时填入对应的URL即可




Garafana报警采坑
首先你需要创建一个报警通知渠道，这个没什么说的 可选的非常多 
email 配置邮件还需要在Grafana中配置好SMTP
webhook 这个是比较推荐的方式，这样后继的处理比较灵活
也可以通过webhook的方式把报警通知到AlertManage
***有一点需要注意的是 Send  reminders这个选项，如果不打开 是收不到报警信息的 该字段定义发送报警的时间 
这里有一点需要注意的是和rule中的 Evaluate every配置 后者是定义多久检查一次
前者是多久发送一次
但是二者的关系 Evaluate every 优先
具体的关系 可以参考 https://grafana.com/docs/grafana/latest/alerting/notifications/



下面详细记录报警规则的设置

Rule部分
Name 设置警报的名称
Evaluate every  评估间隔，也就是说Grafana可以根据你设置的间隔去检查警报触发条件 
For 评估时长，意思是 只有在该时长内 警报阈值一直都是被突破的（比如你设置CPU超过%20就报警，但是For你设置了10S,那只有超过%20状态至少维持10S才会触发报警）

警报状态
一个警报有下面几个状态 
ok		 发送完成
paused   暂停状态
alerting 发送中
pending  待定状态-设置了For时，当触发时不会立即就发送报警，只有状态维持For设定的时间才会发送报警
no_data

Conditions部分
	该部分制定了警报触发的条件，下面是一个例子 
	
avg() OF query(A, 15m, now) IS BELOW 14

avg（）   代表聚合功能，代表如何把数据聚合成一个数据，然后和阈值进行比较，包含的聚合函数有 
	min() 最小值
	max() 最大值
	sum() 和
	count() 总数量
	last() 
	median()
	diff()
	diff_abs()
	percent_diff()
	percent_diff_abs()
	count_non_null()
query(A, 15m, now)  代码查询条件
	A 代码的是Meters的名称
	15m,now代表的是时间范围，标识过去15分钟到现在，你也可以定义类似 15，now-2m，来去掉最后的2分钟数据
IS BELOW 14 “低于14” 代表设置的触发条件，IS BELOW 是判断条件 支持的判断条件还有   需要注意的是测试下来阈值貌似不能为小数
	IS  ABOVE 高于
	IS  BELOW 低于
	IS  OUTSIDE RANGE A B  不在A和B 之间
	IS  WITHIN RANGE  A B  介于A和B之间 
	HAS NO VALUE  没有值
联合查询
	你可以通过AND 或者是OR 进行复杂触发条件的设置
	

	
Grafana中的webhook报警数据结构如下 
{
  "dashboardId":1,
  "evalMatches":[
    {
      "value":1,
      "metric":"Count",
      "tags":{}
    }
  ],
  "imageUrl":"https://grafana.com/static/assets/img/blog/mixed_styles.png",
  "message":"Notification Message",
  "orgId":1,
  "panelId":2,
  "ruleId":1,
  "ruleName":"Panel Title alert",
  "ruleUrl":"http://localhost:3000/d/hZ7BuVbWz/test-dashboard?fullscreen\u0026edit\u0026tab=alert\u0026panelId=2\u0026orgId=1",
  "state":"alerting",
  "tags":{
    "tag name":"tag value"
  },
  "title":"[Alerting] Panel Title alert"
}