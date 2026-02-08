const WXAPI = require('apifm-wxapi')
const { order } = require('../../i18n/zh_CN')
const AUTH = require('../../utils/auth')
const APP = getApp()
APP.configLoadOK = () => {

}
Page({
  data: {
    apiOk: false
  },
  cancelOrderTap: function(e) {
    const that = this;
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      confirmText: this.data.$t.common.confirm,
      cancelText: this.data.$t.common.cancel,
      content: this.data.$t.order.cancelProfile,
      success: function(res) {
        if (res.confirm) {
          WXAPI.orderClose(wx.getStorageSync('token'), orderId).then(function(res) {
            if (res.code == 0) {
              that.onShow();
            }
          })
        }
      }
    })
  },
  toPayTap: function(e) {
    // 防止连续点击--开始
    if (this.data.payButtonClicked) {
      wx.showToast({
        title: this.data.$t.common.doubleClick,
        icon: 'none'
      })
      return
    }
    this.data.payButtonClicked = true
    setTimeout(() => {
      this.data.payButtonClicked = false
    }, 3000)  // 可自行修改时间间隔（目前是3秒内只能点击一次支付按钮）
    // 防止连续点击--结束
    const that = this;
    const orderId = e.currentTarget.dataset.id;
    let money = e.currentTarget.dataset.money;
    const needScore = e.currentTarget.dataset.score;
    WXAPI.userAmount(wx.getStorageSync('token')).then(function(res) {
      if (res.code == 0) {
        // 增加提示框
        if (res.data.score < needScore) {
          wx.showToast({
            title: that.data.$t.order.scoreNotEnough,
            icon: 'none'
          })
          return;
        }
        let _msg = that.data.$t.order.amountReal + ' ' + money
        if (res.data.balance > 0) {
          _msg += ' ' + that.data.$t.order.balance + ' ' + res.data.balance
          if (money - res.data.balance > 0) {
            _msg += ' ' + that.data.$t.order.payAmount + ' ' + (money - res.data.balance)
          }          
        }
        if (needScore > 0) {
          _msg += ' ' + that.data.$t.order.payScore + ' ' + needScore
        }
        money = money - res.data.balance
        wx.showModal({
          content: _msg,
          confirmText: that.data.$t.common.confirm,
          cancelText: that.data.$t.common.cancel,
          success: function (res) {
            console.log(res);
            if (res.confirm) {
              that._toPayTap(orderId, money)
            }
          }
        });
      } else {
        wx.showModal({
          confirmText: that.data.$t.common.confirm,
          cancelText: that.data.$t.common.cancel,
          content: that.data.$t.order.noCashAccount,
          showCancel: false
        })
      }
    })
  },
  _toPayTap: function (orderId, money){
    const _this = this
    if (money <= 0) {
      // 直接使用余额支付
      WXAPI.orderPay(wx.getStorageSync('token'), orderId).then(function (res) {
        _this.onShow();
      })
    } else {
      this.setData({
        paymentShow: true,
        orderId,
        money,
        nextAction: {
          type: 0,
          id: orderId
        }
      })
    }
  },
  paymentOk(e) {
    console.log(e.detail); // 这里是组件里data的数据
    this.setData({
      paymentShow: false
    })
    wx.redirectTo({
      url: '/pages/all-orders/index',
    })
  },
  paymentCancel() {
    this.setData({
      paymentShow: false
    })
  },
  onLoad: function(options) {
    getApp().initLanguage(this)
    wx.setNavigationBarTitle({
      title: this.data.$t.order.title,
    })
  },
  onShow: function() {
    AUTH.checkHasLogined().then(isLogined => {
      if (isLogined) {
        this.doneShow();
      } else {
        wx.showModal({
          confirmText: this.data.$t.common.confirm,
          cancelText: this.data.$t.common.cancel,
          content: this.data.$t.auth.needLogin,
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
      }
    })
  },
  async doneShow() {
    wx.showLoading({
      title: '',
    })
    const res = await WXAPI.orderList({
      token: wx.getStorageSync('token')
    })
    wx.hideLoading()
    if (res.code == 0) {
      const orderList = res.data.orderList
      orderList.forEach(ele => {
        
        // 计算订单是否可取消
        if (ele.status == 1) {
          ele.isCancelable = this.isCancelable(ele.datePay);
        } else {
          ele.isCancelable = false;
        }
        
        if (ele.status == -1) {
          ele.statusStr = this.data.$t.order.status.st01
        }
        if (ele.status == 1 && ele.isNeedLogistics) {
          ele.statusStr = this.data.$t.order.status.st11
        }
        if (ele.status == 1 && !ele.isNeedLogistics) {
          ele.statusStr = this.data.$t.order.status.st10
        }
        if (ele.status == 3) {
          ele.statusStr = this.data.$t.order.status.st3
        }
        //如果已经退款，但是后台没有设置订单结束，也要结束
        if (ele.hasRefund){
            ele.statusStr = this.data.$t.order.status.st01
            ele.status = -1
        }
      })
      this.setData({
        orderList: res.data.orderList,
        logisticsMap: res.data.logisticsMap,
        goodsMap: res.data.goodsMap,
        apiOk: true
      });
      
    } else {
      this.setData({
        orderList: null,
        logisticsMap: {},
        goodsMap: {},
        apiOk: true
      });
    }
  },
  toIndexPage: function() {
    wx.switchTab({
      url: "/pages/index/index"
    });
  },
  // 删除订单
  deleteOrder: function(e){
    const that = this
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      confirmText: this.data.$t.common.confirm,
      cancelText: this.data.$t.common.cancel,
      content: this.data.$t.order.deleteProfile,
      success: function (res) {
        if (res.confirm) {
          WXAPI.orderDelete(wx.getStorageSync('token'), id).then(function (res) {  
            if (res.code == 0) {
              that.onShow(); //重新获取订单列表
            }              
            
          })
        }
      }
    })
  },
  async callShop(e) {
    const shopId = e.currentTarget.dataset.shopid
    const res = await WXAPI.shopSubdetail(shopId)
    if (res.code != 0) {
      wx.showToast({
        title: res.msg,
        icon: 'none'
      })
      return
    }
    wx.makePhoneCall({
      phoneNumber: res.data.info.linkPhone,
    })
  },
  // 判断订单是否可以取消
  isCancelable: function(datePay) {
    if (!datePay) {
      return false;
    }
    
    // 获取取消时间限制（分钟）
    const orderRefundTimeLimit = parseInt(wx.getStorageSync('orderRefundTimeLimit')) || 3;
    if (orderRefundTimeLimit <= 0) {
      return false;
    }
    
    // 计算订单支付时间和当前时间的差值（分钟）
    const payTime = new Date(datePay).getTime();
    const nowTime = new Date().getTime();
    const diffMinutes = Math.floor((nowTime - payTime) / (1000 * 60));
    
    // 如果差值小于等于时间限制，则可以取消
    return diffMinutes <= orderRefundTimeLimit;
  },
  // 取消订单
  cancelOrder: async function(e) {
    const orderId = e.currentTarget.dataset.id
    
    // 获取订单信息
    const order = this.data.orderList.find(item => item.id == orderId)
    if (!order) {
      wx.showToast({
        title: '订单信息错误',
        icon: 'none'
      })
      return
    }
    
    // 再次检查是否可以取消
    if (!this.isCancelable(order.datePay)) {
      wx.showToast({
        title: '商品已开始配送，无法取消订单，请联系商家处理',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 确认取消订单
    wx.showModal({
      confirmText: this.data.$t.common.confirm,
      cancelText: this.data.$t.common.cancel,
      content: this.data.$t.order.cancelProfile,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '取消中...',
          })
          
          try {
            // 调用取消订单接口
            const result = await WXAPI.orderCloseV2({
              token: wx.getStorageSync('token'),
              orderId: orderId,
              remark: '用户主动取消'
            })
            
            wx.hideLoading()
            
            if (result.code == 0) {
              wx.showToast({
                title: '取消成功',
                icon: 'success'
              })
              // 重新加载订单列表
              this.onShow()
            } else {
              wx.showToast({
                title: result.msg || '取消失败',
                icon: 'none'
              })
            }
          } catch (error) {
            wx.hideLoading()
            wx.showToast({
              title: '网络错误，取消失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },
})