var mysql = require('mysql');
var config = require('./config');

var pool = mysql.createPool(config.mysql);

function query(sql, fn) {
  pool.getConnection(function (err, conn) {
    if (err) return fn(err);
    conn.query(sql, function (err1, ret) {
      if (err1) {
        console.log('err1-->' + err1);
        return fn(err1);
      }
      conn.release();
      fn(err1, ret);
    });
  });
}

const insert = (table, where, orderBy) => {
  return new Promise((resolve, reject) => {
    where = where || `1==1`;
    orderBy = orderBy || ``
    let sql = `insert into ${table} where ${where} order by ${orderBy}`;
    excute(sql).then((result) => {
      resolve(result);
    }).catch((err) => {
      reject(err)
    })
  })
}

//Promise 版
const excute = (sql) => {
  return new Promise(async(resolve, reject) => {
    try {
      pool.getConnection((err, conn) => {
        conn.query(sql, (err, result) => {
          conn.release();
          resolve(result);
        })
      })
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  query: query,
  excute: excute
}
