# 目录

[nuve鉴权说明](#nuve鉴权说明)

[service](#service)

[创建service](#创建service)

[获取service列表](#获取service列表)

[获取单个service信息](#获取单个service信息)

[删除单个service](#删除单个service)

[Rooms](#rooms)

[创建房间](#创建房间)

[房间列表](#房间列表)

[获取房间信息](#获取房间信息)

[删除房间](#删除房间)

[Tokens](#tokens)

[创建Token](#创建Token)

[Users](#users)

[房间用户列表](#房间用户列表)

[获取房间内用户信息](#获取房间内用户信息)

[删除用户](#删除用户)

[代码示例](#代码示例)


# 说明
licode的接口部分分成两部分nuve  EC
nuve主要是房间、用户、token管理  对外是提供http服务，
licode/nuve/nuveClient/dist/nuve.js 封装了所有的接口，如果是在nodejs端可以直接使用该文件
移动端则只能整理出所有的接口格式，重新自己封装 

EC主要是负责信令交互，如果是从网页端接入
licode/erizo_controller/erizoClient/dist/erizo.js封装了所有的接口
移动端则需要整理出完整的信令交互流程


# [nuve鉴权说明](#目录)
Authorization 该head每次是必须要带的，他的值是一系列K-V租出的字符串
- Authorization:

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|mauth_username |否  |string |用户名   |
|mauth_role |否  |string | 用户角色    |
|mauth_serviceid|是  |string | nuve服务器ID，配置文件读取  |
|mauth_cnonce     |是  |string | 随机数  |
|mauth_timestamp     |是  |string | 时间戳    |
|mauth_signature     |是  |string | 签名，获取方式看下文    |
另外还有一段固定内容
'MAuth realm=http://marte3.dit.upm.es,mauth_signature_method=HMAC_SHA1'
上面的各个参数和对应的值使用=连接，多个K-V之间使用逗号连接

- 示例
```
Authorization:MAuth realm=http://marte3.dit.upm.es,mauth_signature_method=HMAC_SHA1,mauth_serviceid=5dbc11d889a1d0aca45ba5a7,mauth_cnonce=98073,mauth_timestamp=1582774019442,mauth_signature=YjVjN2EwYmJiODMzMDQ4MDBhZmI5YmRlMDlmZTUyNGYzMjllZDU4Mg==
```

- Content-Type：application/json
接口传输格式为json


- signed是一个由多个元素使用逗号拼接的字符串加密而成
默认是由 mauth_timestamp+mauth_cnonce
如果 mauth_username 和 mauth_role两个不为空的话则需要在后面追加

得到字符串后然后和nuve-key加密而成  nuve-key从配置文件读取
signed=calculateSignature(str,nuve-key)
示例
```
mauth_timestamp=111
mauth_cnonce=222
mauth_username=aa
mauth_role=bb
则生成的加密明文：111,222,aa,bb
```
- calculateSignature函数
对key 和 str 使用sha1使用hmac加密 得到密文A
对密文A再次使用base64加密 得到最终密文
python 环境需要把密文转为ascii即可


# [service](#目录)
service是用来区分不同的服务域提出的概念，一个service对应的是一类开发者的语音服务
一个service 有三个基本的属性  name(名称)  serviceid(服务ID)  key(服务key)
每个service的serviceid-key对都是全局唯一的

在service之上，还有个superservice概念，他代表服务集群本身，
他提供id-key对用来对service相关的操作做鉴权

service相关的接口，在认证头中使用的必须是superserver对应的id-key对

## [创建service](#目录)

**请求URL：** 
- ` http://xx.com/services `
  
**请求方式：**
- POST 

**参数：** 

|参数名|必选|类型|说明|
|:----|:---|:----- |-----   |
|name |是  |string |服务名称 |
|key  |是  |string |服务key     |


**请求示例**
```
  {
    "name": "XXX游戏语音服务",
    "key": "123123"
  }
```

 **返回示例**

``` 
ret-code 200 
5f97c060070b490b49a7b7f1  服务ID

ret-code 401
认证不通过 

ret-code 200
参数错误

```

## [获取service列表](#目录)
**请求URL：** 
- ` http://xx.com/services `
  
**请求方式：**
- GET 


 **返回示例**

``` 
ret-code  401
认证失败 

ret-code 200
[
	{
		'_id': '5e840a110410a611bce8f4d2',
		'name': 'service-A',
		'key': '123',
		'rooms':[
			{
				'_id':"112312312",
				'name':'room-a'
			},
			{
				'_id':"112312312",
				'name':'room-B'
			},
		]
	},
	{
		'_id': '5e840a110410a611bce8f4d2',
		'name': 'service-B',
		'key': '123',
		'rooms':[
			{
				'_id':"112312312",
				'name':'room-a'
			},
			{
				'_id':"112312312",
				'name':'room-B'
			},
		]
	},
]
```

## [获取单个service信息](#目录)
**请求URL：** 
- ` http://xx.com//services/:services_id `
  
**请求方式：**
- GET 

 **返回示例**

``` 
ret-code  401 
认证失败 

ret-code 404
未找到service

ret-code  200

{
	'_id': '5e840a110410a611bce8f4d2',
	'name': 'service-B',
	'key': '123',
	'rooms':[
		{
			'_id':"112312312",
			'name':'room-a'
		},
		{
			'_id':"112312312",
			'name':'room-B'
		},
	]
}
```

## [删除单个service](#目录)
**请求URL：** 
- ` http://xx.com/services/:service_id `
  
**请求方式：**
- DELETE 

 **返回示例**

``` 
ret-code 401
认证失败 

ret-code 404
未找到service

ret-code 200
删除成功
```

# [Rooms](#目录)
一个房间就是一个音频会议室，每个与会人员都可以推流或者是订阅其他的流
一个房间对象有一下几个属性
- name 房间名称
- _id  房间ID
- p2p  可选 布尔值 标识是不是点对点
- data 可选  房间的一些附加信息

## [创建房间](#目录)
**请求URL：** 
- ` http://xx.com//rooms `
  
**请求方式：**
- POST 

**参数：** 

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|name |是  |string |房间名称   |
|options |是  |json对象 | 参数    |
| |参数  |必选 | 类型    |说明|
| |data  |否 | json对象    |房间的附加信息|
| |eapolicy  |是 | string    |房间级联策略 ROOM-BEST 或者 TTL-BEST|

**关于eapolicy**
在创建房间时，用户选择具体的SFU分配策略
- ROOM-BEST 为默认的策略，这种策略下服务器根据房间数量最少优先原则分配SFU
- TTL-BEST为高级策略，这种策略下服务器根据客户端到SFU的网络距离选择最合适的SFU分配


**请求示例**
```
  {
    "name": "test-name",
    "options": {
      "date":{
	  	"room_color": 'red',
		"room_description": 'Room for testing metadata'
	   }
    }
  }
```

 **返回示例**

``` 
{
	'name': 'TEST-ROOM',
	'_id': '5e573703a4cd0a0b66b4ea8d'
}
```

 **返回参数说明** 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|name |string   |房间名称|
|_id |string   |房间ID|

## [房间列表](#目录)
**请求URL：** 
- ` http://xx.com/rooms/ `
  
**请求方式：**
- GET 

 **返回示例**

``` 
ret-code 404 
b'Room does not exist'

ret-code  200

[
	{
		'name': 'basicExampleRoom',
		'data': {'basicExampleRoom': True},
		'mediaConfiguration': 'default',
		'_id': '5dbf9e52e2b9d87712463b70'
	},
	{
		'name': 'TEST-ROOM',
		'_id': '5e5734f5a4cd0a0b66b4ea85'
	},
	{
		'name': 'TEST-ROOM',
		'_id': '5e573523a4cd0a0b66b4ea86'
	},
	{
		'name': 'TEST-ROOM',
		'_id': '5e57354fa4cd0a0b66b4ea87'
	}
]
```

 **返回参数说明** 
- 正常返回的是一个房间的列表

## [获取房间信息](#目录)
**请求URL：** 
- ` http://xx.com//rooms/房间ID `
  
**请求方式：**
- GET

**参数：** 
- URL格式为： /rooms/:room

**请求示例**
```
 http://xx.com/rooms/5dbf9e52e2b9d87712463b70
```

 **返回示例**

``` 
{
	'name': 'basicExampleRoom',
	'data': {'basicExampleRoom': True},
	'_id': '5dbf9e52e2b9d87712463b70'
}
```

 **返回参数说明** 
- 参考其他接口说明


## [删除房间](#目录)
**请求URL：** 
- ` http://xx.com//rooms/房间ID `
  
**请求方式：**
- DELETE

**参数：** 
- URL格式为： /rooms/:room

**请求示例**
```
 http://xx.com/rooms/5dbf9e52e2b9d87712463b70
```

 **返回示例**

``` 
b'Room deleted'

删除不存在的房间时返回
b'Room does not exist'
```

# [Tokens](#目录)
token是一个字符串，主要是用来在加入房间时需要带入进行权限的验证
当你需要添加一个新的成员到房间内时，你需要新创建一个token
当为一个用户创建token时，需要特别的传入该用户的两个属性
- name  姓名
- role  角色
关于如何管理用户的角色，可参考相关的文档 http://lynckia.com/licode/roles.html

## [创建Token](#目录)
**请求URL：** 
- ` http://xx.com//rooms/房间ID/tokens `
  
**请求方式：**
- POST
- 在申请创建token时，Authorization认证头中必须要带mauth_username和mauth_role

**参数：** 
- URL格式为： /rooms/:room/tokens

**请求示例**
```
 http://xx.com/rooms/5dbf9e52e2b9d87712463b70/tokens
```
- 房间ID一定是已经存在的
 **返回示例**

```
res-code:401
b'Name and role?'  认证头中没有带用户名和角色

res-code:404
房间不存在

res-code:200
b'eyJ0b2tlbklkIjoiNWU1NzQ0MWJhNGNkMGEwYjY2YjRlYThlIiwiaG9zdCI6IjE5Mi4xNjguOTQuODE6ODA4MCIsInNlY3VyZSI6ZmFsc2UsInNpZ25hdHVyZSI6IlptSTBaalJoT1dVeVpEUXhaR0l6TWpneU5qZ3pPV001WVRVeVl6ZzJNbUZpTUdZME56aGtZZz09In0='


删除不存在的房间时返回
b'Room does not exist'
```
- 返回的一长串字符串是经过base64加密的数据，解密之后可以到
```
{
	"tokenId":"5e5786572d7bd7027a243489",  
	"host":"192.168.94.81:8080",
	"secure":false,
	"signature":"YzU5NGMwM2Q1ZjIzZTM4OGMzNDhkMTM2ZWQyNWY2ZGMxZjNjZDVmZg=="
}
```
可以看到 返回的就是分配给客户端的EC的连接信息
host 为分配的EC的连接地址
secure标识该连接是否为wss 默认是ws

# [Users](#目录)
用户对象有下面两个属性 
- name   用户名称
- role   用户角色

## [房间用户列表](#目录)
**请求URL：** 
- ` http://xx.com//rooms/房间ID/users/ `
  
**请求方式：**
- GET

**参数：** 
- URL格式为： /rooms/:room/users

**请求示例**
```
 http://xx.com/rooms/5dbf9e52e2b9d87712463b70/users
```

 **返回示例**

```
[
	{
		'name':"test-1",
		'role':'publish'
	},
	{
		'name':"test-2",
		'role':'publish'
	},
	{
		'name':"test-3",
		'role':'publish'
	}
]
```
## [获取房间内用户信息](#目录)
**请求URL：** 
- ` http://xx.com//rooms/房间ID/users/用户名名称 `
  
**请求方式：**
- GET

**参数：** 
- URL格式为： /rooms/:room/users/:user

**请求示例**
```
 http://xx.com/rooms/5dbf9e52e2b9d87712463b70/users/test
```

 **返回示例**

```
ret-code 404
b'User does not exist'

ret-code 200
	{
		'name':"test-1",
		'role':'publish'
	}
```
## [删除用户](#目录)
**请求URL：** 
- ` http://xx.com//rooms/房间ID/users/用户名名称 `
  
**请求方式：**
- DELETE

**参数：** 
- URL格式为： /rooms/:room/users/:user

**请求示例**
```
 http://xx.com/rooms/5dbf9e52e2b9d87712463b70/users/test
```

 **返回示例**

```
ret-code 404
b'Room does not exist'

ret-code 200
b'Success'
```

# [代码示例](#目录)
- 下面是使用python写的demo代码

```
import  time  
import  random
import  http.client
import  json



def calculateSignature(toSign,key):
	from hashlib import sha1
	import hmac
	import binascii
	key =   bytes(key.encode('utf-8'))
	toSign =  toSign.encode('utf-8')
	hasher = hmac.new(key, toSign, sha1)
	# print(hasher.hexdigest())
	hasher =   bytes(hasher.hexdigest().encode("UTF-8"))
	signed = binascii.b2a_base64(hasher)[:-1]
	return signed.decode()
username="quanjie"
role="aa"

if __name__ == '__main__':

	timestamp = int(time.time()*1000)
	cnounce = int(random.random()*99999)
	toSign = str(timestamp) + ',' + str(cnounce)

	header = 'MAuth realm=http://marte3.dit.upm.es,mauth_signature_method=HMAC_SHA1'


	if (username != '' and role != ''):
		header += ',mauth_username='
		header +=  username
		header += ',mauth_role='
		header +=  role

		toSign += ',' + username + ',' + role

	signed = calculateSignature(toSign, "26891")

	header += ',mauth_serviceid='
	header +=  "5dbc11d889a1d0aca45ba5a7"
	header += ',mauth_cnonce='
	header += str(cnounce)
	header += ',mauth_timestamp='
	header +=  str(timestamp)
	header += ',mauth_signature='
	header +=  signed
	# print(header)
	options = {
		"data":"",
		"p2p":True,
		"mediaConfiguration":"default"
	}
	body = json.dumps({"name": "TEST-ROOM", "options": options})
	# print(body)
	conn = http.client.HTTPConnection("192.168.94.81",3000)
	headers = {"Authorization": header, 'Content-Type': 'application/json'}

	#create-room	
	# conn.request("POST", "/rooms/", body, headers)
	# res = conn.getresponse()
	# if res.status == 401:
	# 	print(res.status, res.reason)
	# 	raise Exception('unauthorized')
	# response = res.read()
	# try:
	# 	data = json.loads(response)
	# except Exception:
	# 	data = response

	#get-room-list
	# conn.request("GET", "/rooms/", None, headers)
	# res = conn.getresponse()
	# response = res.read()
	# try:
	# 	data = json.loads(response)
	# except Exception:
	# 	data = response

	#get-room-info
	# conn.request("GET", "/rooms/5dbf9e52e2b9d87712463b70", None, headers)
	# res = conn.getresponse()
	# response = res.read()
	# try:
	# 	data = json.loads(response)
	# except Exception:
	# 	data = response

	#del-room
	# conn.request("DELETE", "/rooms/5dbf9e52e2b9d87712463b70", None, headers)
	# res = conn.getresponse()
	# response = res.read()
	# try:
	# 	data = json.loads(response)
	# except Exception:
	# 	data = response
	
	#create-token
	# conn.request("POST", "/rooms/5e573703a4cd0a0b66b4ea8d/tokens", None, headers)
	# res = conn.getresponse()
	# response = res.read()
	# try:
	# 	data = json.loads(response)
	# except Exception:
	# 	data = response


	#get-users-list
	# conn.request("GET", "/rooms/5e575efe2d7bd7027a2434734/users", None, headers)
	# res = conn.getresponse()
	# response = res.read()
	# try:
	# 	data = json.loads(response)
	# except Exception:
	# 	data = response
	
	#get  user  info 
	# conn.request("GET", "/rooms/5e575efe2d7bd7027a243473/users/test", None, headers)
	# res = conn.getresponse()
	# response = res.read()
	# try:
	# 	data = json.loads(response)
	# except Exception:
	# 	data = response

	#del  user  
	conn.request("DELETE", "/rooms/5e575efe2d7bd7027a243473/users/test", None, headers)
	res = conn.getresponse()
	response = res.read()
	try:
		data = json.loads(response)
	except Exception:
		data = response
```
