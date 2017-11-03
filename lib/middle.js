'use strict';

const AV = require('leancloud-storage');
const util = require('./util');
const moment = require('moment');
const db = require('./db');
const config = require('./config');
const async = require('async');
const pinyin = require('pinyin');

//查询用户heyz_num是否富余
function validHeyzNum(req, res, next){
	var userId = req.decode.userId; //获取用户ID
	console.log('validHeyzNum userId-->' + userId);
	console.log('validHeyzNum req.body-->' + JSON.stringify(req.body));

	if(!req.body.heyzNum || !req.body.openMod || !req.body.openSex || !req.body.range || !req.body.longitude || !req.body.latitude){
		return res.json({status: 1000, data: {}, msg: 'Parameter missing!'});
	}
	var heyzNum =  Number(req.body.heyzNum) || 0; //获取用户输入的黑石数

	var query = new AV.Query('Wallet');
	query.equalTo('userId', userId);

	query.first().then(info => {
		if(info){
			if(heyzNum > info.get('heyz_num')){
				console.log('heyzNum > info.heyz_num');
				return res.json({status: 1003, data:{}, msg: '钱包余额不足'});
			}else{
				console.log('heyzNum <= info.heyz_num');
				next();
			}
		}else{
			//不存在记录
			return res.json({status: 1003, data:{}, msg: '钱包余额不足'});
		}
	}).catch(err => {
		res.json({status: -1, data:{}, msg: err});
	});
}

//查询用户heyz_num是否富余(供自动埋宝箱脚本使用)
const validHeyzNumber = (req, heyzNum) => {
	return new Promise((resolve, reject) => {
		let userId = req.decode.userId;
		console.log('validHeyzNum userId-->' + userId);
		let query = new AV.Query('Wallet');
		query.equalTo('userId', userId);
		query.first().then(info => {
			if(info){
				if(heyzNum > info.get('heyz_num')){
					console.log('heyzNum > info.heyz_num');
					reject('钱包余额不足');
				}else{
					console.log('heyzNum <= info.heyz_num');
					resolve(info)
				}
			}else{
				//不存在记录
				reject('钱包余额不足');
			}
		}).catch(err => {
			 reject('钱包余额不足');
		});
	})
}

//埋宝箱成功，从钱包扣除黑石
function divHeyzNum(req, res){
	return new Promise(function(resolve, reject){
		var userId = req.decode.userId; //获取用户ID
		console.log('divHeyzNum userId-->' + userId);

		var query = new AV.Query('Wallet');
		query.equalTo('userId', userId);
		query.first().then(info => {
			if(info){
				console.log('divHeyzNum info-->' + JSON.stringify(info));
				var u = AV.Object.createWithoutData('Wallet', info.get('objectId'));
				// var amount = info.get('amount') - Number(req.body.heyzNum)/10;
				var tmp = util.oprate(Number(req.body.heyzNum), config.rate, 'div');
				// var amount = util.oprate(info.get('amount'), tmp, 'sub'); //埋宝箱不对amount做操作
				// var heyz_num = info.get('heyz_num') - Number(req.body.heyzNum);
				console.log("req.body.heyzNum --> " + req.body.heyzNum);
				var heyz_num = util.oprate(info.get('heyz_num'), Number(req.body.heyzNum), 'sub');
				// u.set('amount', amount); //埋宝箱不对amount做操作
				console.log('heyz_num -->' + heyz_num);
				u.set('heyz_num', heyz_num);

				u.save().then(v => {
					resolve();
				}).catch(ce => {
					console.log('divHeyzNum ce-->' + ce);
					reject(ce);
				});
			}else{
				reject('invalid wallet');
			}
		}).catch(err => {
			console.log('divHeyzNum err-->' + err);
			reject(err);
		});
	});
}

//埋宝箱成功，成功从钱包扣除黑石，往mysql消费表Consume插入一条记录
function recordHeyzNum(req, res){
	return new Promise(function(resolve, reject){
		var userId = req.decode.userId; //获取用户ID
		console.log('recordHeyzNum userId-->' + userId);

		var heyzNum = Number(req.body.heyzNum);
		var orderNo = moment().format('YYYYMMDDHHmmss') + util.randomNum(4); //时分秒+4位随机数，组成订单号
		var orderName = '埋宝箱';
		var amount = util.oprate(heyzNum, config.rate, 'div');
		var time = moment().format('YYYY-MM-DD HH:mm:ss');
		
		var sql = 'insert into Consume values(null, "'+userId+'", "'+orderNo+'", "'+orderName+'", "'+amount+'", "'+heyzNum+'", "'+time+'", "'+config.rate+'")';
		db.query(sql, function(err, info){
			if(err) {
    		console.log('recordHeyzNum err-->' + err);
    		reject(err);
    	}else{
    		console.log('recordHeyzNum insert success');
    		resolve();
    	}
		});
	});
}

//成功打开宝箱，需要往用户钱包加对应的黑石
function addHeyzNum(userId, heyzNum){
	return new Promise(function(resolve, reject){
		var query = new AV.Query('Wallet');
		query.equalTo('userId', userId);
		query.first().then(info => {
			if(info){
				console.log('addHeyzNum info-->' + JSON.stringify(info));
				var u = AV.Object.createWithoutData('Wallet', info.get('objectId'));
				var heyz_num = util.oprate(info.get('heyz_num'), Number(heyzNum), 'add');
				u.set('heyz_num', heyz_num);

				u.save().then(v => {
					resolve();
				}).catch(ce => {
					console.log('addHeyzNum ce-->' + ce);
					reject(ce);
				});
			}else{
				reject('invalid wallet');
			}
		}).catch(err => {
			console.log('addHeyzNum err-->' + err);
			reject(err);
		});
	});
}

//从MySQL表获取分页信息
//desc：如果需要根据userId查询该用户的数据，对应的tableName需要有userId字段
function getPageInfoByMySql(tableName, userId, page, size, callback){
	var pageSize = 10; //每页记录数

	//如果存在每页大小size
  if(size){
  	//size是数字且大于等于0
		if(util.isNumber(size) && size >= 0){
			pageSize = size;
		}else{
			console.log('size invalid');
			return res.json({status: 1002, data: {}, msg: 'Invalid parameter!'});
		}
  }
  console.log('pageSize -->' + pageSize);
	
	var sql = 'select * from '+tableName+' where 1 = 1';
	var childSql = 'select id from '+tableName+' where 1 = 1';

	//如果存在userId
	if(userId){
		sql += ' and userId = "'+userId+'" ';
		childSql += ' and userId = "'+userId+'" ';
	}

	//如果存在页码page
	if(page){
		//页码是数字且大于等于1
		if(util.isNumber(page) && page >= 1){
			//因为这里做了按time降序，所以id得<=
			sql += ' and id <= ('+childSql+' limit '+(page-1)*pageSize+',1) limit '+pageSize+'';
		}else{
			console.log('page invalid');
			return res.json({status: 1002, data: {}, msg: 'Invalid parameter!'});
		}
	}

	console.log('sql 处理前-->' + sql);
	if(sql.indexOf('limit') > 0){  //用include代替indexOf
		//如果存在limit，在两个limit之前插入'order by time desc'字符串
		var str = sql.split('limit');
		sql = str[0] + ' order by time desc ' + ' limit ' + str[1] + ' order by time desc ' + ' limit ' + str[2];
	}else{
		//否则，在sql字符串尾部插入'order by time desc'字符串
		sql += ' order by time desc';
	}
	console.log('sql 处理后-->' + sql);
	db.query(sql, function(err, result){
		if(err){
    	return callback(err);
    }
    callback(null, result);
	});
}

//根据宝箱ID查询宝箱黑石数
function getHeyzNumById(chestId){
	return new Promise(function(resolve, reject){
		var query = new AV.Query("Chest");
		query.equalTo('objectId', chestId);

		query.first().then(info => {
			if(info){
				var heyzNum = info.get('heyzNum');
				console.log('getHeyzNumById heyzNum-->' + heyzNum);
				resolve(heyzNum);
			}else{
				resolve();
			}
		}).catch(err => {
			reject(err);
		});
	});
}

//设置用户头像/形象认证/语音认证
function authByFileId(userId, fileId, type){
	return new Promise( (resolve, reject) => {
		console.log('come info authByFileId');
		let user = AV.Object.createWithoutData('_User', userId);
		let query = new AV.Query("_File");
		query.select('url');
		query.equalTo('objectId', fileId);

		console.log('authByFileId fileId -->' + JSON.stringify(fileId));

		query.first().then( (info) => {
			if(!info){
				reject('No files');
			}else{
				console.log('authByFileId info exists');
				console.log('authByFileId info -->' + JSON.stringify(info));

				let url = info.get("url");
				console.log('url-->' + url);
				if(type === 'avatarId'){
					//设置用户头像
					console.log('valid avatar-->');
					//这样写是需要审核头像的
					// user.set("avatarStatus", true);
			  //   user.set("newAvatar", info);
			  //   user.set("newAvatarURL", url);

			  	//直接跳过审核
			  	user.set("avatarStatus", false);
			  	user.set('avatar', info);
			  	user.set('avatarURL', url);
				}else if(type === 'videoId'){
					//形象认证
				console.log('valid video-->');
				user.set("videoIdObj", info);
			    user.set("videoIdStr", url);

			    //修改视频，清零点赞用户及点赞数
			    let map = {};
			    user.set('videoUserMap', map);
			    user.set('videoLikeNum', 0);
				}else if(type === 'audioId'){
					//语音认证
					console.log('valid audio-->');
					user.set("audioIdObj", info);
			    user.set("audioIdStr", url);

			    //修改语音，清零点赞用户及点赞数
			    let map = {};
			    user.set('audioUserMap', map);
			    user.set('audioLikeNum', 0);
				}else if(type === 'imgId'){
					user.set('imgIdStr', url);
				}
				return user.save();
			}
		}).then(info => {
			resolve();
		}).catch(err => {
			reject(err);
		});
	});
}

//记录钱包黑石数的使用情况
function walletRecord(info, callback){
	console.log('walletRecord come~');
	let sql = 'insert into TradeRecord values(null, "'+info.userId+'", "'+info.type+'", "'+info.status+'", "'+info.heyzNum+'", "'+info.time+'", "'+info.timeStamp+'")';
	db.query(sql, (err, result) => {
		if(err) {
			return callback(err);
		}
		callback(null, result);
	});
}

//根据fileId获取文件URL
function getFileURL( fileId ){
	return new Promise( (resolve, reject) => {
		let query = new AV.Query("_File");
		query.select('url');
		query.equalTo('objectId', fileId);

		query.first().then( file => {
			if(file) {
				let fileURL = file.get("url");
				resolve(fileURL);
			}else{
				reject('file is not exist');
			}
		}).catch( err => {
			reject(err);
		});
	});
}

//根据fileId Array获取fileURL Array
function getArrayFileURL(arr) {
	return new Promise( (resolve, reject) => {
		if( arr && Array.isArray(arr) ){
			let newArr = [];
			async.forEach(arr, (item, callback) => {
				getFileURL(item).then(info => {
					newArr.push(info);
					callback();
				}).catch(e => {
					callback(e);
				});
			}, (err, result) => {
				if(err) {
					reject(err);
				}else{
					resolve(newArr);
				}
			});
		}else{
			reject('params must be Array');
		}
	});
}

//根据评论Id获取评论内容
function getContentByCommentId(id) {
	return new Promise( (resolve, reject) => {
		let query = new AV.Query('DynamicComments');
		query.equalTo('objectId', id);
		query.select('content');

		query.first().then(comment => {
			if(comment) {
				resolve(comment);
			}else{
				reject('comment is not exist');
			}
		}).catch(err => {
			reject(err);
		});
	});
}

//将评论Id添加进动态的comments中
function pushIdToDynamic(id, dynamicId){
	return new Promise( (resolve, reject) => {
		let query = new AV.Query('Dynamic');
		query.equalTo('objectId', dynamicId);
		query.select('comments');

		query.first().then(dynamic => {
			let comments = dynamic.get('comments'); //获取评论Array
			comments.push(id);

			let obj = AV.Object.createWithoutData('Dynamic', dynamicId);
			obj.set('comments', comments);
			return obj.save();
		}).then(v => {
			resolve();
		}).catch(err => {
			reject(err);
		});
	});
}

//我的关注用户和粉丝列表数据组装
function followList(arr) {
  let list = [], dict = {};
  let nickName, firstName, key, sorted, asc;
  arr.forEach((el) => {
  	nickName = el.get("nickName");
    firstName = pinyin(nickName, {style: pinyin.STYLE_NORMAL}).join("");
    key = firstName.substr(0, 1);
    sorted = key;
    asc = key ? key.charCodeAt() : 0; //首字母的ASC码
    if(asc > 0x60 && asc <= 0x7a){ // 'a'~'z'
      key = String.fromCharCode(asc - 0x20);
      sorted = key;
    }else if (asc > 0x40 && asc <= 0x5a){ // 'A'~'Z'
    
    }else {
      key = "#";
      sorted = "^";
    }
    if(!dict[key]) {
      dict[key] = [];
      list.push({key, sorted, users: dict[key]});
    }
    dict[key].push(util.userBrief(el));
  });
  let newList = list.sort((s, t) => {
  	let ss = s.sorted;
  	let st = t.sorted;
  	if(ss < st) return -1;
  	if(ss > st) return 1;
  	return 0;
  });
  return newList;
}

//推送
function push(toUserId, data){
	return new Promise(function(resolve, reject){
		// let params = {alert: msg, sound: "default", type: 20, badge: "Increment"}; //发送推送
  	AV.Push.send({channels: toUserId, prod: config.pushConfig.PROFILE, data: data}).then(() => {
  		resolve();
  	}).catch(err => {
  		reject(err);
  	});
	});
}

//根据动态ID获取动态信息
function getDynamicById(dynamicId){
	return new Promise((resolve, reject) => {
		let q = new AV.Query('Dynamic');
		q.equalTo('objectId', dynamicId);
		q.first().then(v => {
			resolve(v);
		}).catch(e => {
			reject(e);
		});
	});
}

//根据拍卖品ID查询是否处于添加成功状态
function getAuctionById(req, res, next){
	let aucId = req.body.aucId || req.query.aucId; //拍卖品ID
	let q = new AV.Query('Auction');
	q.equalTo('objectId', aucId);
	q.first().then(v => {
		if(v){
			if(v.get('status') === 1){
				//处于添加成功状态
				next();
			}else{
				return res.json({status: 401, data:{}, msg: 'forbidden'});
			}
		}else{
			return res.json({status: -1, data:{}, msg: 'auction is not exist'});
		}
	}).catch(err => {
		console.log(`middle getAuctionById err is ${err.stack}`);
		return res.json({status: -1, data:{}, msg: err.stack});
	});
}

//根据状态判断拍品是否存在 --为job服务
function existAuctionByStatus(status){
	return new Promise((resolve, reject) => {
		let query = new AV.Query('Auction');
		query.equalTo('status', status); 
		query.limit(1);

		query.first().then(v => {
			if(v){
				//存在
				reject('auction is exist');
			}else{
				//不存在
				resolve();
			}
		}).catch(err => {
			reject(err);
		});
	});
}

//根据状态获取距离开拍时间15分钟的拍品 --为job服务
function getAuction(status){
	return new Promise((resolve, reject) => {
		let start = moment().add(15, 'm').format('YYYY-MM-DD HH:mm');
		console.log(`getAuction start is ${start}`);

		let query = new AV.Query('Auction');
		query.equalTo('status', status);
		query.equalTo('startTime', start);
		query.limit(1);

		query.first().then(v => {
			if(v){
				//存在
				resolve(v);
			}else{
				//不存在
				reject('auction is not exist');
			}
		}).catch(err => {
			reject(err);
		});
	});
}

//根据状态获取拍品 --为job服务
function getAuctionByStatus(status){
	return new Promise((resolve, reject) => {
		let query = new AV.Query('Auction');
		query.equalTo('status', status);
		query.limit(1);

		query.first().then(v => {
			if(v){
				//存在
				resolve(v);
			}else{
				//不存在
				reject('auction is not exist');
			}
		}).catch(err => {
			reject(err);
		});
	});
}

//根据用户ID获取用户钱包
function getWalletByUserId(userId){
	return new Promise((resolve, reject) => {
		var query = new AV.Query('Wallet');
		query.equalTo('userId', userId);

		query.first().then(info => {
			if(info){
				resolve(info);
			}else{
				//不存在记录
				reject('钱包余额为0');
			}
		}).catch(err => {
			reject(err);
		});
	});
}

module.exports = {
	'validHeyzNum': validHeyzNum,
	'validHeyzNumber': validHeyzNumber,
	'divHeyzNum': divHeyzNum,
	'recordHeyzNum': recordHeyzNum,
	'addHeyzNum': addHeyzNum,
	'getPageInfoByMySql': getPageInfoByMySql,
	'getHeyzNumById': getHeyzNumById,
	'authByFileId': authByFileId,
	'walletRecord': walletRecord,
	'getFileURL': getFileURL,
	'getArrayFileURL': getArrayFileURL,
	'getContentByCommentId': getContentByCommentId,
	'pushIdToDynamic': pushIdToDynamic,
	'followList': followList,
	'push': push,
	'getDynamicById': getDynamicById,
	'getAuctionById': getAuctionById,
	'existAuctionByStatus': existAuctionByStatus,
	'getAuctionByStatus': getAuctionByStatus,
	'getAuction': getAuction,
	'getWalletByUserId': getWalletByUserId
}