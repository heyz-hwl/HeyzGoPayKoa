const AV = require('leancloud-storage');
const router = require('koa-router')()
const jwt = require('../lib/jwt');
const _ = require('lodash');
const url = `http://www.lzj.party/wz/`;

router.prefix('/v1')

//获取英雄列表
router.get('/hero',
  async(ctx, next) => {
    ctx.body = {
      status: 200,
      data: {
        heroMsg: heroMsg
      },
      msg: `success`
    }
  }
)

//王者荣耀信息的增删改查
router.post('/hokInfo',
  jwt.verify,
  async(ctx, next) => {
    let data = ctx.request.body;
    let userId = ctx.query.userId;
    if (!data.type || !userId) {
      return ctx.body = {
        status: -1,
        data: {},
        msg: `Params Missing`
      }
    }
    if (data.default == true) {
      let query = new AV.Query('HOK');
      query.equalTo('userId', userId);
      query.equalTo('default', true);
      let result = await query.first()
      if (!_.isUndefined(result)) {
        let hokObj = AV.Object.createWithoutData('HOK', result.get('objectId'));
        hokObj.set('default', false);
        await hokObj.save()
      }
    }
    let hokInfo = AV.Object.new('HOK');
    hokInfo.set('ID', data.ID);
    hokInfo.set('type', String(data.type));
    hokInfo.set('userId', userId);
    hokInfo.set('position', _.get(data, 'position', []));
    hokInfo.set('hero', _.get(data, 'hero', []));
    hokInfo.set('default', _.get(data, 'default', true));
    let user = AV.Object.createWithoutData('_User', userId);
    hokInfo.set('user', user);
    let ret = await hokInfo.save()
    ctx.body = {
      status: 200,
      data: ret,
      msg: `success`
    }
  })

//删
router.delete('/hokInfoDelete',
  jwt.verify,
  async(ctx, next) => {
    try {
      let data = ctx.request.body
      if (_.isUndefined(data.HOKId)) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `Params Missing`
        }
      }
      let hokInfo = AV.Object.createWithoutData('HOK', data.HOKId)
      let ret = await hokInfo.destroy()
      ctx.body = {
        status: 200,
        data: ret,
        msg: `delete hokInfo success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: err
      }
    }
  })

//delete for post
router.post('/hokInfoDelete',
  jwt.verify,
  async(ctx, next) => {
    try {
      let data = ctx.request.body
      if (_.isUndefined(data.HOKId)) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `Params Missing`
        }
      }
      let hokInfo = AV.Object.createWithoutData('HOK', data.HOKId)
      let ret = await hokInfo.destroy()
      ctx.body = {
        status: 200,
        data: ret,
        msg: `delete hokInfo success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: err
      }
    }
  })

router.put('/hokInfo',
  jwt.verify,
  async(ctx, next) => {
    try {
      let data = ctx.request.body;
      if (_.isUndefined(data.HOKId)) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `Params Missing`
        }
      }
      let query = new AV.Query('HOK');
      query.equalTo('objectId', data.HOKId);
      let Hok = query.first()
      if (_.isUndefined(Hok)) {
        return ctx.body = {
          status: 200,
          data: {},
          msg: `no HOK`
        }
      }
      if (data.default == true) {
        let query = new AV.Query('HOK');
        query.equalTo('userId', Hok.get('userId'));
        query.equalTo('default', true);
        let result = await query.first()
        if (!_.isUndefined(result)) {
          let hokObj = AV.Object.createWithoutData('HOK', result.get('objectId'));
          hokObj.set('default', false);
          await hokObj.save()
        }
      }
      let hokInfo = AV.Object.createWithoutData('HOK', data.HOKId)
      hokInfo.set('default', data.default);
      if (data.ID) {
        hokInfo.set('ID', data.ID);
      }
      if (data.type) {
        hokInfo.set('type', String(data.type));
      }
      if (data.position) {
        hokInfo.set('position', data.position);
      }
      if (data.hero) {
        hokInfo.set('hero', data.hero);
      }
      let ret = await hokInfo.save()
      ctx.body = {
        status: 200,
        data: ret,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        msg: `put hokInfo err is ${err}`
      }
    }
  })

//通过 userId 获取 hokInfo
router.get('/hokInfoByUserId',
  jwt.verify,
  async(ctx, next) => {
    try {
      let data = [];
      let userId = _.get(ctx, 'decode.userId', ctx.query.userId);      
      console.log(`userId is ${userId}`)
      if (!userId) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `Params Missing`
        }
      }
      let query = new AV.Query('HOK')
      query.equalTo('userId', userId)
      let result = await query.find()
      if (!result) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `no data`
        }
      }
      result.forEach(async (item, index) => {
        let background = `${url}${heroMap[item.get('hero')[0]]}`;
        item.set('background', background);
        if (item.get('default')) {
          data.push(item);
          data.push(index);
        }
      })
      if (!_.isUndefined(data[0])) { //data[0]是默认卡片, data[1]是它所在的位置
        result.splice(data[1], 1);
        result.unshift(data[0]);
      }
      return ctx.body = {
        status: 200,
        data: result,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        data: {},
        msg: `get hokInfo byUserId err is ${err}`
      }
    }
  }
)

router.get('/hokInfoByHOKId',
  jwt.verify,
  async(ctx, next) => {
    try {
      let HOKId = ctx.query.HOKId;
      if (!HOKId) {
        return res.json({
          status: -1,
          data: {},
          msg: `Params Missing`
        })
      }
      let query = new AV.Query('HOK')
      query.equalTo('objectId', HOKId)
      let result = query.first()
      if (!result) {
        return ctx.body = {
          status: -1,
          data: {},
          msg: `no data`
        }
      }
      let background = `${url}${heroMap[result.get('hero')[0]]}`;
      result.set('background', background);
      ctx.body = {
        status: 200,
        data: result,
        msg: `success`
      }
    } catch (err) {
      ctx.body = {
        status: -1,
        msg: `get hokInfo by HOKId err is ${err}`
      }
    }
  })

const heroMsg = [{
    name: '百里玄策',
    url: url + '196.jpg'
  },
  {
    name: '百里守约',
    url: url + '195.jpg'
  },
  {
    name: '铠',
    url: url + '193.jpg'
  },
  {
    name: '黄忠',
    url: url + '192.jpg'
  },
  {
    name: '大乔',
    url: url + '191.jpg'
  },
  {
    name: '诸葛亮',
    url: url + '190.jpg'
  },
  {
    name: '鬼谷子',
    url: url + '189.jpg'
  },
  {
    name: '东皇太一',
    url: url + '187.jpg'
  },
  {
    name: '太乙真人',
    url: url + '186.jpg'
  },
  {
    name: '蔡文姬',
    url: url + '184.jpg'
  },
  {
    name: '雅典娜',
    url: url + '183.jpg'
  },
  {
    name: '干将莫邪',
    url: url + '182.jpg'
  },
  {
    name: '哪吒',
    url: url + '180.jpg'
  },
  {
    name: '杨戬',
    url: url + '178.jpg'
  },
  {
    name: '成吉思汗',
    url: url + '177.jpg'
  },
  {
    name: '钟馗',
    url: url + '175.jpg'
  },
  {
    name: '虞姬',
    url: url + '174.jpg'
  },
  {
    name: '李元芳',
    url: url + '173.jpg'
  },
  {
    name: '张飞',
    url: url + '171.jpg'
  },
  {
    name: '刘备',
    url: url + '170.jpg'
  },
  {
    name: '后羿',
    url: url + '169.jpg'
  },
  {
    name: '牛魔',
    url: url + '168.jpg'
  },
  {
    name: '孙悟空',
    url: url + '167.jpg'
  },
  {
    name: '亚瑟',
    url: url + '166.jpg'
  },
  {
    name: '橘右京',
    url: url + '163.jpg'
  },
  {
    name: '娜可露露',
    url: url + '162.jpg'
  },
  {
    name: '不知火舞',
    url: url + '157.jpg'
  },
  {
    name: '张良',
    url: url + '156.jpg'
  },
  {
    name: '花木兰',
    url: url + '154.jpg'
  },
  {
    name: '兰陵王',
    url: url + '153.jpg'
  },
  {
    name: '王昭君',
    url: url + '152.jpg'
  },
  {
    name: '韩信',
    url: url + '150.jpg'
  },
  {
    name: '刘邦',
    url: url + '149.jpg'
  },
  {
    name: '姜子牙',
    url: url + '148.jpg'
  },
  {
    name: '露娜',
    url: url + '146.jpg'
  },
  {
    name: '程咬金',
    url: url + '144.jpg'
  },
  {
    name: '安琪拉',
    url: url + '142.jpg'
  },
  {
    name: '貂蝉',
    url: url + '141.jpg'
  },
  {
    name: '关羽',
    url: url + '140.jpg'
  },
  {
    name: '老夫子',
    url: url + '139.jpg'
  },
  {
    name: '武则天',
    url: url + '136.jpg'
  },
  {
    name: '项羽',
    url: url + '135.jpg'
  },
  {
    name: '达摩',
    url: url + '134.jpg'
  },
  {
    name: '狄仁杰',
    url: url + '133.jpg'
  },
  {
    name: '马可波罗',
    url: url + '132.jpg'
  },
  {
    name: '李白',
    url: url + '131.jpg'
  },
  {
    name: '宫本武藏',
    url: url + '130.jpg'
  },
  {
    name: '典韦',
    url: url + '129.jpg'
  },
  {
    name: '曹操',
    url: url + '128.jpg'
  },
  {
    name: '甄姬',
    url: url + '127.jpg'
  },
  {
    name: '夏侯惇',
    url: url + '126.jpg'
  },
  {
    name: '周瑜',
    url: url + '124.jpg'
  },
  {
    name: '吕布',
    url: url + '123.jpg'
  },
  {
    name: '芈月',
    url: url + '121.jpg'
  },
  {
    name: '白起',
    url: url + '120.jpg'
  },
  {
    name: '扁鹊',
    url: url + '119.jpg'
  },
  {
    name: '孙膑',
    url: url + '118.jpg'
  },
  {
    name: '钟无艳',
    url: url + '117.jpg'
  },
  {
    name: '阿轲',
    url: url + '116.jpg'
  },
  {
    name: '高渐离',
    url: url + '115.jpg'
  },
  {
    name: '刘禅',
    url: url + '114.jpg'
  },
  {
    name: '庄周',
    url: url + '113.jpg'
  },
  {
    name: '鲁班七号',
    url: url + '112.jpg'
  },
  {
    name: '孙尚香',
    url: url + '111.jpg'
  },
  {
    name: '嬴政',
    url: url + '110.jpg'
  },
  {
    name: '妲己',
    url: url + '109.jpg'
  },
  {
    name: '墨子',
    url: url + '108.jpg'
  },
  {
    name: '赵云',
    url: url + '107.jpg'
  },
  {
    name: '小乔',
    url: url + '106.jpg'
  },
  {
    name: '廉颇',
    url: url + '105.jpg'
  }
]

const heroMap = {
  '百里玄策': '196.jpg',
  '百里守约': '195.jpg',
  '铠': '193.jpg',
  '黄忠': '192.jpg',
  '大乔': '191.jpg',
  '诸葛亮': '190.jpg',
  '鬼谷子': '189.jpg',
  '东皇太一': '187.jpg',
  '太乙真人': '186.jpg',
  '蔡文姬': '184.jpg',
  '雅典娜': '183.jpg',
  '干将莫邪': '182.jpg',
  '哪吒': '180.jpg',
  '杨戬': '178.jpg',
  '成吉思汗': '177.jpg',
  '钟馗': '175.jpg',
  '虞姬': '174.jpg',
  '李元芳': '173.jpg',
  '张飞': '171.jpg',
  '刘备': '170.jpg',
  '后羿': '169.jpg',
  '牛魔': '168.jpg',
  '孙悟空': '167.jpg',
  '亚瑟': '166.jpg',
  '橘右京': '163.jpg',
  '娜可露露': '162.jpg',
  '不知火舞': '157.jpg',
  '张良': '156.jpg',
  '花木兰': '154.jpg',
  '兰陵王': '153.jpg',
  '王昭君': '152.jpg',
  '韩信': '150.jpg',
  '刘邦': '149.jpg',
  '姜子牙': '148.jpg',
  '露娜': '146.jpg',
  '程咬金': '144.jpg',
  '安琪拉': '142.jpg',
  '貂蝉': '141.jpg',
  '关羽': '140.jpg',
  '老夫子': '139.jpg',
  '武则天': '136.jpg',
  '项羽': '135.jpg',
  '达摩': '134.jpg',
  '狄仁杰': '133.jpg',
  '马可波罗': '132.jpg',
  '李白': '131.jpg',
  '宫本武藏': '130.jpg',
  '典韦': '129.jpg',
  '曹操': '128.jpg',
  '甄姬': '127.jpg',
  '夏侯惇': '126.jpg',
  '周瑜': '124.jpg',
  '吕布': '123.jpg',
  '芈月': '121.jpg',
  '白起': '120.jpg',
  '扁鹊': '119.jpg',
  '孙膑': '118.jpg',
  '钟无艳': '117.jpg',
  '阿轲': '116.jpg',
  '高渐离': '115.jpg',
  '刘禅': '114.jpg',
  '庄周': '113.jpg',
  '鲁班七号': '112.jpg',
  '孙尚香': '111.jpg',
  '嬴政': '110.jpg',
  '妲己': '109.jpg',
  '墨子': '108.jpg',
  '赵云': '107.jpg',
  '小乔': '106.jpg',
  '廉颇': '105.jpg'
}

module.exports = {
  router: router,
  heroMap: heroMap
}
