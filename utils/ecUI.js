const showModal = (title, content, cb) => {
    wx.showModal({
        title,
        content,
        showCancel: false,
        complete: () => {
            if (cb) { cb() }
        },
    })
}

const showLoading = title => {
    wx.showLoading({
      title: title,
      mask: true
    })
}

const hideLoading = () => {
    console.log('hideLoading');
    wx.hideLoading()
}

module.exports = {
    showModal,
    showLoading,
    hideLoading
}
