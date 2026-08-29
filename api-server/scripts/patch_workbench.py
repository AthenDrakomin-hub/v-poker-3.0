import io

file_path = r"C:\Users\88903\Desktop\V-poker-2.0\v-poker-uni-app\pages\workbench\workbench.vue"
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: goBack - check page stack, fallback to reLaunch
old_back = """    goBack() {
      uni.navigateBack()
    },"""

new_back = """    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.reLaunch({ url: '/pages/lobby/lobby' })
      }
    },"""

if old_back in content:
    content = content.replace(old_back, new_back, 1)
    print("REPLACED goBack")
else:
    print("NOT FOUND goBack")

# Fix 2: Increase font sizes - add a font scale override at the top of the style
# Find the style tag and add font size overrides
old_style_start = "<style lang=\"scss\" scoped>"
if old_style_start in content:
    font_override = """<style lang="scss" scoped>
/* 字体放大：覆盖全局小字体变量 */
:deep(.section-title) { font-size: max(2.2vh, 18px) !important; }
:deep(.section-subtitle) { font-size: max(1.6vh, 14px) !important; }
:deep(.stat-value) { font-size: max(2.4vh, 20px) !important; }
:deep(.stat-label) { font-size: max(1.5vh, 13px) !important; }
:deep(.player-name) { font-size: max(1.9vh, 16px) !important; }
:deep(.player-account) { font-size: max(1.5vh, 13px) !important; }
:deep(.stat-num) { font-size: max(1.8vh, 15px) !important; }
:deep(.stat-desc) { font-size: max(1.3vh, 11px) !important; }
:deep(.action-btn) { font-size: max(1.5vh, 13px) !important; min-height: 36px; }
:deep(.transaction-item) { font-size: max(1.5vh, 13px) !important; }
:deep(.modal-title) { font-size: max(2vh, 17px) !important; }
:deep(.form-label) { font-size: max(1.6vh, 14px) !important; }
:deep(.points-value) { font-size: max(1.8vh, 15px) !important; }
:deep(.invite-code) { font-size: max(2.2vh, 18px) !important; }
"""
    content = content.replace(old_style_start, font_override, 1)
    print("REPLACED style fonts")
else:
    print("NOT FOUND style tag")

with io.open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("DONE")
