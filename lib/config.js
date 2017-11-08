module.exports = {
	'pingpp': {
		'appId': 'app_4ej5aHi9WD4CHSqv',
		'secretKey': 'sk_live_C0eLKC0avjzHDifv9GnrfjPS'
	},
	//mysql连接配置
	'mysql': {
		'connectionLimit': 10,
		'host': '127.0.0.1',     
		'user': 'root',   
		'password': 'heyzmysql',
		'database':'heyzgopay',
		'port': 3306  
	},
	//heyzgo项目配置
	"heyzgo": {
    "ID": "MSJbWUTcCWVTXiE2fQPGqOjK-gzGzoHsz",
    "Key": "d61hBu0XPcpoNkpf1HkqQx68",
    "API": "https://api.leancloud.cn/1.1/functions/",
    "headers": {
      "X-LC-Id": "MSJbWUTcCWVTXiE2fQPGqOjK-gzGzoHsz",
      "X-LC-Key": "d61hBu0XPcpoNkpf1HkqQx68"
    },
    "MasterKey": "6h5aOhVlOegJ1gJdKSTWNAHh"
  },
  //jwt相关信息
  'jwt': {
  	'secret': 'heyzgopay',
  	'expiresIn': 60*120, //120分钟 token expiresIn(token过期时间)
  	// expiresIn: '20h'
  	'allowExpiresIn': 60*30 //30分钟(允许token过期的时间范围)
  	// 'allowExpiresIn': 60*30 //30分钟
  },
  //黑石数:人民币
  'rate': 10,
  //兴趣爱好，可根据具体需求更换
  'hobby': [
    {'name': '运动', 'url': 'https://dn-msjbwutc.qbox.me/92bc937dd8e7fc6463a7.png'},
    {'name': '阅读', 'url': 'https://dn-msjbwutc.qbox.me/fc26650cbcc11df32cda.png'},
    {'name': '电影', 'url': 'https://dn-msjbwutc.qbox.me/5938f9723109c3471ac3.png'},
    {'name': '餐饮', 'url': 'https://dn-msjbwutc.qbox.me/26c61288c0b5b0b834e7.png'},
    {'name': '玩乐', 'url': 'https://dn-msjbwutc.qbox.me/1f50ec1496782aa4cc39.png'},
    {'name': '旅游', 'url': 'https://dn-msjbwutc.qbox.me/1937dee92509967eb687.png'},
    {'name': '交友', 'url': 'https://dn-msjbwutc.qbox.me/d5af602f82916d28f606.png'},
    {'name': '其他', 'url': 'https://dn-msjbwutc.qbox.me/befbc0b3fdde1abfc6e7.png'}
  ],
  'pushConfig': {
    'PROFILE': 'dev'
  },
  //redis连接信息
  'redisConfig': 'redis://:heyzWebRedis2016@127.0.0.1:6379/1'
}