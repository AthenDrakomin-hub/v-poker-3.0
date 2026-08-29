import App from './App'
import { initLogger } from './utils/logger.js'

// 初始化日志（生产环境自动禁用 console.log/warn/debug）
initLogger()

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
	...App
})
app.$mount()
// #endif

// #ifdef VUE3
import {
	createSSRApp
} from 'vue'
import { registerCdnGlobal } from './utils/cdn.js'
export function createApp() {
	const app = createSSRApp(App)
	// 注册全局 $cdn 方法：模板中 <image :src="$cdn('/static/logo.png')" />
	registerCdnGlobal(app)

	// 全局错误边界：捕获组件渲染错误，避免白屏
	app.config.errorHandler = (err, instance, info) => {
		console.error('[Vue Error]', info, err)
		// 可以在这里上报错误到监控系统
		try {
			uni.showToast({
				title: '页面加载异常，请重试',
				icon: 'none',
				duration: 2000
			})
		} catch (e) {}
	}

	return {
		app
	}
}
// #endif
