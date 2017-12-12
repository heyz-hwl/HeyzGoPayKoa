const mysql = require('mysql');
const config = require('./config');

let pool = mysql.createPool(config.mysql);

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
const select = (table, condition, limit, skip, option) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `select * from ${table} where ${condition} `
      console.log(`sql ->${sql}`)
      if (option) {
        sql += `${option} `
        console.log(`sql3 ->${sql}`)
      }
      sql += `limit ${skip}, ${limit}`
      let ret = await db.excute(sql)
      resolve(ret)
    } catch (err) {
      reject(`db find err -->${err}`)
    }
  })
}

const insert = (table, values, option) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `insert into "${table}" values(null, ${values})`
      let ret = await db.excute(sql)
      resolve(ret)
    } catch (err) {
      reject(`db insert err -->${err}`)
    }
  })
}

const update = (table, values, condition, option) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `update ${table} set ${values} where ${condition} option`
      let ret = await db.excute(sql)
      resolve(ret)
    } catch (err) {
      reject(`db update err -->${err}`)
    }
  })
}

const rm = (table, condition) => {
  return new Promise(async(resolve, reject) => {
    try {
      let sql = `delete from ${table} where ${condition}`
      let ret = await db.excute(ret)
      resolve(ret)
    } catch (err) {
      reject(`db delete err -->${err}`)
    }
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

const db = {
  query: query,
  excute: excute,
  select: select
}


module.exports = db
