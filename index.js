var request = require('request')
var cheerio = require('cheerio')
var async = require('async')
var url = require('url')

var config = require('./config')

var getOption = {
  method: 'GET',
  charset: 'utf-8',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.93 Safari/537.36'
  }
}

function createOption (path, prefix = 'http://market.scau.edu.cn') {
  var url = prefix + path
  return Object.assign({ url }, getOption)
}

var postOption = {
  url: config.yyshare.url,
  method: 'POST',
  json: true,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + config.yyshare.token
  },
}

function postGoods (idlegood) {
  var option = Object.assign({
    body: idlegood
  }, postOption)

  request(option, (err, res, body) => {
    if (!err && res.statusCode === 200) {
      console.log(idlegood.title, ' post success!')
    } else {
      console.error(idlegood.title, ' post failed！error：', err)
    }
  })
}

function fetchDetail (option) {
  return request(option, (err, res, body) => {
    if (!err && res.statusCode === 200) {
      var $ = cheerio.load(body)

      var idlegood = {}
      // 设置状态为待审核
      idlegood.status = 0
      idlegood.account_id = 0
      idlegood.location = '广州市'
      idlegood.campus = '华南农业大学'
      idlegood.link = option.url
      idlegood.title = $('h2').text()
      idlegood.h_name = $('.name').text()
      idlegood.price = $('.price').text().replace(/[^0-9.]/, '')

      var picNodes = $('.banner ul li img')
      var pics = []
      picNodes.map(v => {
        pics.push(url.resolve('http://market.scau.edu.cn', picNodes[v].attribs.src))
      })

      idlegood.cover_pic = pics[0]
      idlegood.pic = pics.join(',')

      var contactText = $('.contact p').text().replace(/[^0-9：]/g, '')
      var contact = contactText.split('：')
      idlegood.qqwechat = contact[1]
      idlegood.phone = contact[2]

      var wrapText = $('.wrap').eq(1).find('p').text()
      var detail = wrapText.split('：')
      idlegood.face_to_face = detail[1].replace(/[付款方式\s]/g, '')
      idlegood.deal_way = detail[2].replace(/[商品有效时间\s]/g, '')
      idlegood.valid_time = detail[3].replace(/[交易状态\s]/g, '')
      idlegood.h_status = detail[4].replace(/[商品描述\s]/g, '')
      idlegood.content = $('.good-bewrite').html()

      idlegood.brand_degree = $('.main-msg').find('p').eq(0).text().replace(/[新旧程成度：\s]/g, '')

      // console.log(JSON.stringify(idlegood))
      postGoods(idlegood)
    }
  })
}

/**
 * 控制并发数
 *
 * @param {any} urls 列表 url 数组
 * @param {any} limit 最大并发数
 */
function asyncFetch (urls, limit) {
  async.mapLimit(urls, limit, (url, cb) => {
    var option = createOption(url)

    fetchDetail(option)
    cb()
  })
}


/**
 * 文件执行入口
 *
 * @param {any} url 入口url
 * @returns
 */
function entry (url) {
  return new Promise ((resolve, reject) => {
    var option = createOption(url, '')

    request(option, (err, res, body) => {
      if (!err && res.statusCode === 200) {
        resolve(body)
      } else {
        reject(err)
      }
    })
  }).then(data => {
    var $ = cheerio.load(data)
    var aNodes = $('#sales .goodsName a')
    var urls = []
    aNodes.map(v => {
      urls.push(aNodes[v].attribs.href)
    })

    asyncFetch(urls, config.limit)

  }).catch(err => {
    console.error(err)
  })
}

entry(config.entry)
