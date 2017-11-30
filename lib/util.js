const _ = require('lodash');
//从数组里删除指定的某个数据
const deleObjFromArray = (array, obj) => {
  return array.splice(array.indexOf(obj), 1)
}

//判断是否是数字
function isNumber(theObj) {
  var reg = /^[0-9]+.?[0-9]*$/;
  if (reg.test(theObj)) {
    console.log('isNumber-->true');
    return true;
  }
  console.log('isNumber-->false');
  return false;
}

//生成N为随机数
function randomNum(n) {
  var t = '';
  for (let i = 0; i < n; i++) {
    t += Math.floor(Math.random() * 10);
  }
  return t;
}

//生成从minNum到maxNum的随机数
const randomNumber = (minNum, maxNum) => {
  if (!maxNum) {
    return parseInt(Math.random() * minNum + 1, 10);
  } else {
    return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
  }
}

//数字精度处理
function oprate(a, b, mod) {
  var objA = toInteger(a);
  var objB = toInteger(b);

  var n1 = objA.num;
  var n2 = objB.num;

  var t1 = objA.times;
  var t2 = objB.times;

  var max = t1 > t2 ? t1 : t2;
  var result = null;
  switch (mod) {
    case 'add':
      //加法
      if (t1 === t2) { //两个小数位数一样
        result = n1 + n2;
      } else if (t1 > t2) { //objA小数位大于objB
        result = n1 + n2 * (t1 / t2);
      } else {
        result = n2 + n1 * (t2 / t1);
      }
      return result / max;
      break;
    case 'sub':
      //减法
      if (t1 === t2) {
        result = n1 - n2;
      } else {
        result = a * max - b * max;
      }
      return result / max;
      break;
    case 'mul':
      //乘法
      result = (n1 * n2) / (t1 * t2);
      return result;
      break;
    case 'div':
      //除法
      return result = function () {
        var r1 = n1 / n2;
        var r2 = t2 / t1;
        return oprate(r1, r2, 'mul');
      }()
      break;
    case '':
      break;
  }
}

//判断是否是整数
function isInteger(obj) {
  return Math.floor(obj) === obj;
}

//将一个浮点数转为整数，返回整数和倍数。如3.14 >> 314，倍数是100
function toInteger(num) {
  var ret = {
    num: 0,
    times: 1
  };
  if (isInteger(num)) {
    ret.num = num;
    return ret;
  }

  var str = num + ''; //转成字符串
  var dotPos = str.indexOf('.');
  var len = str.substr(dotPos + 1).length;
  var times = Math.pow(10, len);
  var initNum = parseInt(num * times + 0.5, 10);

  ret.times = times;
  ret.num = initNum;
  return ret;
}

//获取当前时间戳
function getTimeStamp() {
  var d = new Date().getTime();
  return Math.round(d / 1000);
}

//date转timeStamp
function date2TimeStamp(date) {
  var d = new Date(date);
  return Math.round(d.getTime() / 1000); //加上毫秒数
}

const getUserInfo = (user) => {
  let userInfo = {
    userId: user.get('objectId'),
    nickName: _.isUndefined(user.get('nickName')) ? '' : user.get('nickName'),
    avatarThumbnailURL: _.isUndefined(user.get('avatarURL')) ? '' : user.get('avatarURL'),
    gender: _.isUndefined(user.get('gender')) ? '' : user.get('gender'),
    onlineTime: user.get(`onlineTime`)
  }
  return userInfo
}

//提取用户简要信息
function userBrief(user) {
  let userInfo = {};
  userInfo.userId = user.id;
  userInfo.grade = user.get('grade');  
  userInfo.nickName = user.get("nickName") ? user.get("nickName") : '';
  userInfo.avatarURL = user.get("avatarURL") ? user.get("avatarURL") : '未设置';
  userInfo.avatarThumbnailURL = user.get("avatarURL") ? user.get("avatarURL") + "?imageView/2/w/100/h/100/q/100/format/png" : '';
  userInfo.level = user.get("level") ? user.get("level") : 1;
  userInfo.gender = user.get("gender") ? user.get("gender") : 1;
  userInfo.college = user.get("college") ? user.get("college") : "未设置";
  userInfo.academy = user.get("academy") ? user.get("academy") : "未设置";
  userInfo.certify = user.get("certify") ? user.get("certify") : 0;
  userInfo.zodiac = birthday2zodiac(user.get("birthday") ? user.get("birthday") : undefined);
  userInfo.onlineTime = user.get(`onlineTime`);
  if (user.get("newAvatarURL"))
    userInfo.newAvatarURL = user.get("newAvatarURL") + "?imageView/2/w/200/h/200/q/100/format/png";
  return userInfo;
}

//提取用户信息
function userInfo(user) {
  let userInfo = {};
  userInfo.userId = user.id;
  userInfo.grade = user.get('grade');
  userInfo.HeyzId = user.get("HeyzId");
  userInfo.mobilePhoneNumber = user.get("mobilePhoneNumber");
  userInfo.avatarURL = user.get("avatarURL") ? user.get("avatarURL") : "未设置";
  userInfo.avatarThumbnailURL = user.get("avatarURL") ? (user.get("avatarURL") + "?imageView/2/w/200/h/200/q/100/format/png") : "";
  userInfo.avatarStatus = user.get("avatarStatus");
  userInfo.newAvatarURL = user.get("newAvatarURL") ? user.get("newAvatarURL") : "";
  userInfo.videoIdStr = user.get("videoIdStr") ? user.get("videoIdStr") : ""; //视频认证文件url
  userInfo.audioIdStr = user.get("audioIdStr") ? user.get("audioIdStr") : ""; //语音认证文件url
  userInfo.imgIdStr = user.get("imgIdStr") ? user.get("imgIdStr") : ""; //视频认证文件第一张图片url
  userInfo.username = user.get("username") ? user.get("username") : "未设置";
  userInfo.nickName = user.get("nickName") ? user.get("nickName") : "未设置昵称";
  userInfo.realName = user.get("realName") ? user.get("realName") : "未设置真实姓名";
  userInfo.QRcode = user.get("QRcode") ? user.get("QRcode") : "未设置二维码";
  userInfo.backgroundURL = user.get("backgroundURL") ? user.get("backgroundURL") : "未设置";
  userInfo.gender = user.get("gender") ? user.get("gender") : 1;
  userInfo.profile = user.get("profile") ? user.get("profile") : "未设置";
  userInfo.certify = user.get("certify") ? user.get("certify") : 0;
  userInfo.level = user.get("level") ? user.get("level") : 1;
  userInfo.exp = user.get("exp") ? user.get("exp") : 0;
  userInfo.areaCode = user.get("areaCode") ? user.get("areaCode") : 0;
  userInfo.longitude = user.get("location") ? user.get("location").longitude : 104.480609;
  userInfo.latitude = user.get("location") ? user.get("location").latitude : 36.305564;
  userInfo.college = user.get("college") ? user.get("college") : "未设置";
  userInfo.academy = user.get("academy") ? user.get("academy") : "未设置";
  userInfo.enrol = user.get("enrol") ? user.get("enrol") : "未设置";
  userInfo.personalTags = user.get("personalTags") ? user.get("personalTags") : [];
  userInfo.hobbyTags = user.get("hobbyTags") ? user.get("hobbyTags") : [];
  userInfo.loverTags = user.get("loverTags") ? user.get("loverTags") : [];
  userInfo.createdAt = date2TimeStamp(user.createdAt);
  userInfo.updatedAt = date2TimeStamp(user.updatedAt);
  userInfo.checkinMax = user.get("checkinMax"); //留言打卡上限
  userInfo.produceMax = user.get("produceMax"); //埋胶囊上限
  userInfo.openMax = user.get("openMax"); //开胶囊上限
  userInfo.greetMax = user.get("greetMax"); //打招呼上限
  userInfo.friendMax = user.get("friendMax"); //好友上限
  let birthday = user.get("birthday");
  userInfo.birthday = birthday ? date2TimeStamp(birthday) : 820425600;
  userInfo.age = birthday2age(birthday ? birthday : undefined);
  userInfo.zodiac = birthday2zodiac(birthday ? birthday : undefined);
  userInfo.badgeCount = user.get("badgeIds").length; //勋章数
  userInfo.height = user.get("height") ? user.get("height") : 0; //身高
  userInfo.major = user.get("major") ? user.get("major") : ''; //专业
  userInfo.onlineTime = user.get(`onlineTime`);
  userInfo.blockList = user.get(`blockList`);
  return userInfo;
}

function birthday2zodiac(birthday) {
  let month = birthday ? birthday.getMonth() : 0;
  let day = birthday ? birthday.getDate() : 1;
  let str = "魔羯水瓶双鱼牡羊金牛双子巨蟹狮子处女天秤天蝎射手魔羯";
  let array = [21, 19, 21, 20, 21, 22, 23, 23, 23, 23, 22, 22];
  return str.substr((month + 1) * 2 - (day < array[month] ? 2 : 0), 2) + "座";
}

function birthday2age(birthday) {
  let currentYear = new Date().getFullYear();
  let year = birthday ? birthday.getFullYear() : 1996;
  let age = currentYear - year;
  return age;
}

//推送内容构造方法
function PushConstruct(obj) {
  this.alert = obj.alert;
  this.sound = obj.sound;
  this.default = obj.default;
  this.type = obj.type;
  this.badge = obj.badge;
  this.detail = obj.detail;
}

module.exports = {
  isNumber: isNumber,
  randomNumber: randomNumber,
  randomNum: randomNum,
  oprate: oprate,
  getTimeStamp: getTimeStamp,
  userBrief: userBrief,
  date2TimeStamp: date2TimeStamp,
  userInfo: userInfo,
  PushConstruct: PushConstruct,
  getUserInfo: getUserInfo
}
