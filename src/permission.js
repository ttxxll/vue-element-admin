import router from './router'
import store from './store'
import { Message } from 'element-ui'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css' // progress bar style
import { getToken } from '@/utils/auth' // get token from cookie
import getPageTitle from '@/utils/get-page-title'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const whiteList = ['/login', '/auth-redirect'] // no redirect whitelist

// 全局前置路由守卫：在每次路由导航发生时，在导航确认之前被调用的，只要有导航行为，beforeEach 都会被触发
router.beforeEach(async(to, from, next) => {
  // start progress bar
  NProgress.start()

  // set page title
  document.title = getPageTitle(to.meta.title)

  // determine whether the user has logged in
  const hasToken = getToken()
  console.log('hasToken', hasToken)

  if (hasToken) {
    if (to.path === '/login') {
      // 已登录用户，路由到首页
      next({ path: '/' })
      NProgress.done() // 关闭进度条 hack: https://github.com/PanJiaChen/vue-element-admin/pull/2939
    } else {
      // 如果已经有角色信息，直接放行当前的 beforeEach 守卫
      // 但这不代表用户一定能访问目标页面，因为后面还有路由匹配和权限判断
      // Vue Router 会根据 to.path 是否存在于 accessedRoutes 中来决定是否允许访问
      const hasRoles = store.getters.roles && store.getters.roles.length > 0
      if (hasRoles) {
        next()
      } else {
        try {
          // 首次或者登录后，获取角色信息
          // 之后，如果用户角色信息发生变化，会自动重新获取角色信息：['admin']或者['developer','editor']
          const { roles } = await store.dispatch('user/getInfo')

          // 基于角色动态生成可访问路由表
          const accessRoutes = await store.dispatch('permission/generateRoutes', roles)

          // 添加到路由表
          router.addRoutes(accessRoutes)

          // 导航到目标路由，且是route.replace不会留下重复历史记录
          next({ ...to, replace: true })
        } catch (error) {
          // remove token and go to login page to re-login
          await store.dispatch('user/resetToken')
          Message.error(error || 'Has Error')
          next(`/login?redirect=${to.path}`)
          NProgress.done()
        }
      }
    }
  } else {
    // 没有token且尝试访问页面不在whiteList中，可以放行
    if (whiteList.indexOf(to.path) !== -1) {
      next()
    } else {
      // 没有token且尝试访问页面在whiteList中，重定向到登录页
      next(`/login?redirect=${to.path}`)
      NProgress.done()
    }
  }
})

// 在每次路由导航成功完成之后被调用的
router.afterEach(() => {
  // finish progress bar
  NProgress.done()
})
