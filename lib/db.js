'use strict';

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
  return new Promise((resolve, reject) => {
    pool.getConnection((err, conn) => {
      if(err){
        reject(err)
      }
      conn.query(sql, (err1, result) => {
        if(err1){
          console.log('err1-->' + err1);
          reject(err1)
        }
        conn.release();
        resolve(result);
      })
    })
  })
}

module.exports = {
  query: query,
  excute: excute
}
