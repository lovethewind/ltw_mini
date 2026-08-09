# 清空笔记回收站

## 问题与处理

- 网页版和小程序原先只能逐条永久删除，回收站缺少批量清理入口。
- 后端新增 `DELETE /note/recycle-bin`，在事务内解除笔记与历史版本的资源引用，再删除回收站笔记、文件夹、历史版本及标签关系。
- 网页版侧栏和小程序回收站筛选栏新增二次确认的“清空”操作，成功后同步清空列表与回收站数量。

## 相关文件

- `apps/web/controller/note_controller.py`
- `apps/web/service/note_service.py`
- `src/api/note.ts`、`src/stores/note.ts`、`src/components/note/NoteSidebar.vue`、`src/views/note/NoteWorkspace.vue`
- `utils/note.js`、`pages/note/index.*`
