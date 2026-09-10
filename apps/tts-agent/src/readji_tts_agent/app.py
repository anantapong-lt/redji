from __future__ import annotations

import faulthandler
import os
from pathlib import Path
import platform
import sys
from threading import Event
import time
import uuid

import httpx
from PySide6.QtCore import QAbstractTableModel, QEvent, QModelIndex, Qt, QSettings, QThread, QTimer, Signal
from PySide6.QtGui import QColor, QPainter
from PySide6.QtWidgets import QApplication, QDialog, QFrame, QGraphicsDropShadowEffect, QHBoxLayout, QHeaderView, QLabel, QProgressBar, QStyle, QStyleOptionViewItem, QVBoxLayout, QWidget
from qfluentwidgets import BodyLabel, ComboBox, FluentIcon, FluentWindow, InfoBar, InfoBarPosition, LineEdit, MessageBox, NavigationItemPosition, PasswordLineEdit, PrimaryPushButton, ProgressBar, PushButton, SubtitleLabel, TableItemDelegate, TableView

from .api import ApiClient, ApiError
from .renderer import RenderError, VoxCpmRenderer
from .ffmpeg_setup import FFmpegSetupCancelled, ffmpeg_path, install_ffmpeg, verify_ffmpeg
from .secure_store import clear_refresh_token, load_refresh_token, save_refresh_token

DEFAULT_API_URL = os.environ.get("READJI_TTS_API_URL", "http://localhost:4000")
VOXCPM_MODEL_ID = "openbmb/VoxCPM2"
PROGRESS_REPORT_INTERVAL = 5
JOB_STATUS_POLL_SECONDS = 3
CHAPTER_PAGE_SIZE = 20
TTS_JOB_STATUS = {
    "QUEUED": "queued",
    "PROCESSING": "processing",
    "DONE": "done",
    "FAILED": "failed",
    "CANCELLED": "cancelled",
}

VOICE_SLOT = {
    "FEMALE": "female",
    "YOUNG_MALE": "young_male",
    "OLD_MALE": "old_male",
}
VOICE_LABELS = {
    VOICE_SLOT["FEMALE"]: "ผู้หญิง",
    VOICE_SLOT["YOUNG_MALE"]: "ผู้ชายวัยหนุ่ม",
    VOICE_SLOT["OLD_MALE"]: "ผู้ชายสูงวัย",
}

STATUS_PRESENTATION = {
    TTS_JOB_STATUS["QUEUED"]: ("อยู่ในคิว", "#fff7ed", "#c2410c"),
    TTS_JOB_STATUS["PROCESSING"]: ("กำลังสร้างเสียง", "#eff6ff", "#1d4ed8"),
    TTS_JOB_STATUS["DONE"]: ("สร้างเสร็จแล้ว", "#ecfdf5", "#047857"),
    TTS_JOB_STATUS["FAILED"]: ("สร้างไม่สำเร็จ", "#fef2f2", "#b91c1c"),
    TTS_JOB_STATUS["CANCELLED"]: ("ยกเลิกแล้ว", "#f4f4f5", "#52525b"),
}

TABLE_COLUMN = {
    "STORY": 0,
    "CHAPTER": 1,
    "WORDS": 2,
    "VOICE": 3,
    "STATUS": 4,
    "ACTION": 5,
}


class ChaptersTableModel(QAbstractTableModel):
    headers = ("นิยาย", "ตอน", "คำ", "เสียง", "สถานะ", "การทำงาน")

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.chapters: list[dict] = []
        self.selected_voices: dict[str, str] = {}

    def replace(self, chapters: list[dict]) -> None:
        self.beginResetModel()
        self.chapters = chapters
        self.endResetModel()

    def chapter_at(self, row: int) -> dict:
        return self.chapters[row]

    def update_chapter(self, chapter_id: str, changes: dict) -> int | None:
        for row, chapter in enumerate(self.chapters):
            if chapter["chapter_id"] == chapter_id:
                chapter.update(changes)
                self.dataChanged.emit(self.index(row, 0), self.index(row, self.columnCount() - 1), [])
                return row
        return None

    def voice_for(self, chapter: dict) -> str:
        saved_voice = chapter.get("latest_voice_slot")
        if saved_voice not in VOICE_LABELS:
            saved_voice = VOICE_SLOT["FEMALE"]
        if chapter.get("latest_job_status") in (TTS_JOB_STATUS["QUEUED"], TTS_JOB_STATUS["PROCESSING"]):
            return saved_voice
        return self.selected_voices.get(chapter["chapter_id"], saved_voice)

    def flags(self, index: QModelIndex):
        flags = super().flags(index)
        if index.isValid() and index.column() == TABLE_COLUMN["VOICE"]:
            chapter = self.chapter_at(index.row())
            if chapter.get("latest_job_status") not in (TTS_JOB_STATUS["QUEUED"], TTS_JOB_STATUS["PROCESSING"]):
                flags |= Qt.ItemFlag.ItemIsEditable
        return flags

    def setData(self, index: QModelIndex, value, role: int = Qt.ItemDataRole.EditRole) -> bool:
        if (not index.isValid() or index.column() != TABLE_COLUMN["VOICE"]
                or role != Qt.ItemDataRole.EditRole or value not in VOICE_LABELS
                or not (self.flags(index) & Qt.ItemFlag.ItemIsEditable)):
            return False
        self.selected_voices[self.chapter_at(index.row())["chapter_id"]] = value
        self.dataChanged.emit(index, index, [Qt.ItemDataRole.DisplayRole, Qt.ItemDataRole.EditRole])
        return True

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        return 0 if parent.isValid() else len(self.chapters)

    def columnCount(self, parent: QModelIndex = QModelIndex()) -> int:
        return 0 if parent.isValid() else len(self.headers)

    def headerData(self, section: int, orientation: Qt.Orientation, role: int = Qt.ItemDataRole.DisplayRole):
        if orientation == Qt.Orientation.Horizontal and role == Qt.ItemDataRole.DisplayRole:
            return self.headers[section]
        return None

    def data(self, index: QModelIndex, role: int = Qt.ItemDataRole.DisplayRole):
        if not index.isValid() or index.row() >= len(self.chapters):
            return None
        chapter = self.chapters[index.row()]
        if index.column() == TABLE_COLUMN["VOICE"]:
            if role == Qt.ItemDataRole.EditRole:
                return self.voice_for(chapter)
            if role == Qt.ItemDataRole.ToolTipRole:
                return "ยกเลิกงานเดิมก่อนเปลี่ยนเสียง" if chapter.get("latest_job_status") in (TTS_JOB_STATUS["QUEUED"], TTS_JOB_STATUS["PROCESSING"]) else "เลือกเสียงสำหรับตอนนี้ก่อนเข้าคิว"
        if role == Qt.ItemDataRole.TextAlignmentRole and index.column() in (TABLE_COLUMN["WORDS"], TABLE_COLUMN["VOICE"]):
            return Qt.AlignmentFlag.AlignCenter
        if role != Qt.ItemDataRole.DisplayRole:
            return None
        values = (
            chapter["story_title"],
            f"{chapter['chapter_number']}: {chapter['chapter_title']}",
            str(chapter["word_count"]),
            VOICE_LABELS[self.voice_for(chapter)],
            "",
            "",
        )
        return values[index.column()]


class ChapterTableDelegate(TableItemDelegate):
    action_clicked = Signal(str)

    def initStyleOption(self, option: QStyleOptionViewItem, index: QModelIndex) -> None:
        super().initStyleOption(option, index)
        if index.column() == TABLE_COLUMN["VOICE"] and self.parent().isPersistentEditorOpen(index):
            # QStyledItemDelegate rebuilds the text from DisplayRole during
            # paint, so suppress it here, underneath the translucent ComboBox.
            # Keep the model's label and the normal row background intact.
            option.text = ""

    def createEditor(self, parent, option, index):
        if index.column() != TABLE_COLUMN["VOICE"]:
            return super().createEditor(parent, option, index)
        editor = ComboBox(parent)
        editor.setMinimumWidth(0)
        editor.setFixedHeight(32)
        for value, label in VOICE_LABELS.items():
            editor.addItem(label, userData=value)
        editor.currentIndexChanged.connect(lambda _index: self.commitData.emit(editor))
        return editor

    def setEditorData(self, editor, index) -> None:
        if index.column() != TABLE_COLUMN["VOICE"]:
            super().setEditorData(editor, index)
            return
        editor.blockSignals(True)
        editor.setCurrentIndex(editor.findData(index.data(Qt.ItemDataRole.EditRole)))
        editor.blockSignals(False)

    def setModelData(self, editor, model, index) -> None:
        if index.column() == TABLE_COLUMN["VOICE"]:
            model.setData(index, editor.currentData(), Qt.ItemDataRole.EditRole)
        else:
            super().setModelData(editor, model, index)

    def updateEditorGeometry(self, editor, option, index) -> None:
        if index.column() != TABLE_COLUMN["VOICE"]:
            super().updateEditorGeometry(editor, option, index)
            return
        rect = option.rect.adjusted(6, 0, -6, 0)
        rect.setWidth(max(0, rect.width()))
        rect.setHeight(32)
        rect.moveTop(option.rect.top() + (option.rect.height() - 32) // 2)
        editor.setMaximumWidth(rect.width())
        editor.setGeometry(rect)

    @staticmethod
    def _content_rect(rect):
        return rect.adjusted(8, 9, -8, -9)

    def paint(self, painter: QPainter, option: QStyleOptionViewItem, index: QModelIndex) -> None:
        model = index.model()
        if not isinstance(model, ChaptersTableModel):
            super().paint(painter, option, index)
            return
        chapter = model.chapter_at(index.row())
        column = index.column()
        if column not in (TABLE_COLUMN["STATUS"], TABLE_COLUMN["ACTION"]):
            super().paint(painter, option, index)
            return
        super().paint(painter, option, index)
        if column == TABLE_COLUMN["STATUS"]:
            label, background, color = STATUS_PRESENTATION.get(chapter.get("latest_job_status"), ("ยังไม่ได้สร้าง", "#f4f4f5", "#52525b"))
            if chapter.get("latest_job_status") == TTS_JOB_STATUS["PROCESSING"] and chapter.get("latest_progress") is not None:
                label = f"{label} {chapter['latest_progress']}%"
            self._paint_pill(painter, self._content_rect(option.rect), label, background, color)
            return
        job_status = chapter.get("latest_job_status")
        if job_status not in (TTS_JOB_STATUS["QUEUED"], TTS_JOB_STATUS["PROCESSING"]):
            label = "สร้างใหม่" if job_status == TTS_JOB_STATUS["DONE"] else "เข้าคิว"
            self._paint_pill(painter, self._content_rect(option.rect), label, "#0f9fae", "#ffffff")

    @staticmethod
    def _paint_pill(painter: QPainter, rect, text: str, background: str, color: str) -> None:
        painter.save()
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(background))
        painter.drawRoundedRect(rect, 9, 9)
        painter.setPen(QColor(color))
        painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, text)
        painter.restore()

    def editorEvent(self, event, model, option: QStyleOptionViewItem, index: QModelIndex) -> bool:
        if index.column() != TABLE_COLUMN["ACTION"] or not isinstance(model, ChaptersTableModel):
            return super().editorEvent(event, model, option, index)
        chapter = model.chapter_at(index.row())
        if chapter.get("latest_job_status") in (TTS_JOB_STATUS["QUEUED"], TTS_JOB_STATUS["PROCESSING"]):
            return False
        if event.type() == QEvent.Type.MouseButtonRelease and event.button() == Qt.MouseButton.LeftButton:
            if self._content_rect(option.rect).contains(event.position().toPoint()):
                self.action_clicked.emit(chapter["chapter_id"])
                return True
        return super().editorEvent(event, model, option, index)


class LoginThread(QThread):
    succeeded = Signal(object, str, str)
    failed = Signal(str)

    def __init__(self, email: str, password: str) -> None:
        super().__init__()
        self.email = email
        self.password = password

    def run(self) -> None:
        try:
            client = ApiClient(DEFAULT_API_URL)
            result = client.login(self.email, self.password, platform.node() or "Windows Agent")
            self.succeeded.emit(client, result["refresh_token"], result["user"]["display_name"])
        except (ApiError, httpx.HTTPError) as error:
            self.failed.emit(str(error))


def is_voxcpm_model_cached() -> bool:
    try:
        from huggingface_hub import snapshot_download
        snapshot_download(VOXCPM_MODEL_ID, local_files_only=True)
        return True
    except Exception:
        return False


class ModelDownloadThread(QThread):
    completed = Signal()
    failed = Signal(str)

    def run(self) -> None:
        try:
            from huggingface_hub import snapshot_download
            snapshot_download(VOXCPM_MODEL_ID)
            self.completed.emit()
        except Exception as error:
            self.failed.emit(f"{type(error).__name__}: {error}")


class ModelDownloadDialog(QDialog):
    ready = Signal()

    def __init__(self, parent: QWidget) -> None:
        super().__init__(parent)
        self.setWindowTitle("กำลังเตรียม VoxCPM2")
        self.setModal(True)
        self.setFixedWidth(460)
        self.setWindowFlag(Qt.WindowCloseButtonHint, False)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 28, 28, 28)
        layout.setSpacing(12)
        layout.addWidget(SubtitleLabel("กำลังดาวน์โหลดโมเดลเสียงครั้งแรก", self))
        layout.addWidget(BodyLabel("กำลังดาวน์โหลด openbmb/VoxCPM2 (ประมาณ 5 GB)\nกรุณาอย่าปิดโปรแกรมหรือเริ่มงานซ้ำระหว่างดาวน์โหลด", self))
        self.progress = QProgressBar(self)
        self.progress.setRange(0, 0)
        layout.addWidget(self.progress)
        self.status = BodyLabel("กำลังเชื่อมต่อ Hugging Face...", self)
        self.status.setStyleSheet("color: #71717a;")
        layout.addWidget(self.status)
        self.thread = ModelDownloadThread()
        self.thread.completed.connect(self._completed)
        self.thread.failed.connect(self._failed)

    def start(self) -> None:
        self.thread.start()
        self.show()

    def _completed(self) -> None:
        self.progress.setRange(0, 1)
        self.progress.setValue(1)
        self.status.setText("ดาวน์โหลดโมเดลเสร็จแล้ว กำลังเริ่มงาน...")
        self.ready.emit()
        self.accept()

    def _failed(self, message: str) -> None:
        self.progress.setRange(0, 1)
        self.progress.setValue(0)
        self.status.setText(f"ดาวน์โหลดไม่สำเร็จ: {message}")
        self.setWindowFlag(Qt.WindowCloseButtonHint, True)
        self.show()


class FFmpegSetupThread(QThread):
    progress = Signal(int, int, str)

    def __init__(self, parent: QWidget) -> None:
        super().__init__(parent)
        self.cancel_requested = Event()
        self.error_message: str | None = None
        self.cancelled = False

    def run(self) -> None:
        try:
            install_ffmpeg(self.progress.emit, self.cancel_requested)
        except FFmpegSetupCancelled:
            self.cancelled = True
        except Exception as error:
            self.error_message = str(error)


class FFmpegSetupDialog(QDialog):
    ready = Signal()

    def __init__(self, parent: QWidget) -> None:
        super().__init__(parent)
        self.thread: FFmpegSetupThread | None = None
        self.setWindowTitle("เตรียม FFmpeg สำหรับแอป")
        self.setModal(True)
        self.setFixedWidth(520)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.addWidget(SubtitleLabel("กำลังเตรียมเครื่องมือรวมเสียง", self))
        hint = BodyLabel(
            "หากยังไม่มี FFmpeg แอปจะดาวน์โหลดจาก gyan.dev ประมาณ 104 MB\n"
            "ติดตั้งไว้ใช้เฉพาะแอป ไม่แก้ PATH และยังไม่เริ่มแปลงเสียง", self,
        )
        hint.setWordWrap(True)
        layout.addWidget(hint)
        location = BodyLabel(str(ffmpeg_path().parent), self)
        location.setWordWrap(True)
        layout.addWidget(location)
        self.progress = QProgressBar(self)
        layout.addWidget(self.progress)
        self.status = BodyLabel("กำลังตรวจสอบ...", self)
        self.status.setWordWrap(True)
        layout.addWidget(self.status)
        buttons = QHBoxLayout()
        self.retry_button = PrimaryPushButton("ลองใหม่", self)
        self.retry_button.clicked.connect(self.start)
        self.cancel_button = PushButton("ยกเลิก", self)
        self.cancel_button.clicked.connect(self.reject)
        buttons.addStretch(1)
        buttons.addWidget(self.retry_button)
        buttons.addWidget(self.cancel_button)
        layout.addLayout(buttons)

    def start(self) -> None:
        if self.thread is not None:
            if self.thread.isRunning():
                return
            self.thread.deleteLater()
        self.retry_button.hide()
        self.cancel_button.setEnabled(True)
        self.cancel_button.setText("ยกเลิก")
        self.progress.setRange(0, 0)
        self.status.setText("กำลังตรวจสอบ FFmpeg...")
        self.thread = FFmpegSetupThread(self)
        self.thread.progress.connect(self._progress)
        self.thread.finished.connect(self._completed)
        self.show()
        self.thread.start()

    def _progress(self, done: int, total: int, message: str) -> None:
        if self.thread is not None and self.thread.cancel_requested.is_set():
            return
        self.progress.setRange(0, 100 if total else 0)
        if total:
            self.progress.setValue(min(100, int(done * 100 / total)))
        if done > 1:
            amount = f"{done / 1024 / 1024:.1f} MB"
            if total:
                amount += f" / {total / 1024 / 1024:.1f} MB"
            message += f" {amount}"
        self.status.setText(message)

    def _completed(self) -> None:
        if self.thread is None:
            return
        if self.thread.cancelled or self.thread.cancel_requested.is_set():
            super().reject()
        elif self.thread.error_message:
            self.progress.setRange(0, 100)
            self.progress.setValue(0)
            self.status.setText(f"เตรียม FFmpeg ไม่สำเร็จ: {self.thread.error_message}")
            self.retry_button.show()
            self.cancel_button.setText("ปิด")
        else:
            self.accept()
            self.ready.emit()

    def reject(self) -> None:
        if self.thread is not None and self.thread.isRunning():
            self.thread.cancel_requested.set()
            self.cancel_button.setEnabled(False)
            self.status.setText("กำลังยกเลิกการดาวน์โหลด กรุณารอสักครู่...")
            return
        super().reject()

    def closeEvent(self, event) -> None:
        if self.thread is not None and self.thread.isRunning():
            self.reject()
            event.ignore()
            return
        super().closeEvent(event)


class ModelPreloadThread(QThread):
    def __init__(self, renderer: VoxCpmRenderer) -> None:
        super().__init__()
        self.renderer = renderer
        self.error_message: str | None = None

    def run(self) -> None:
        try:
            self.renderer.preload()
        except Exception as error:
            self.error_message = f"{type(error).__name__}: {error}"


class LoginPage(QWidget):
    signed_in = Signal(object, str)

    def __init__(self) -> None:
        super().__init__()
        self.login_thread: LoginThread | None = None
        self.setStyleSheet("background: #f7f7f5;")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(24, 24, 24, 24)
        outer.addStretch(1)
        card = QFrame(self, objectName="loginCard")
        card.setMaximumWidth(560)
        card.setStyleSheet("QFrame#loginCard { background: white; border: 1px solid #e8e7e3; border-radius: 30px; } QLineEdit { min-height: 46px; padding: 0 14px; border: 1px solid #d9d7d1; border-radius: 12px; background: white; } QLineEdit:focus { border: 2px solid #7c3aed; }")
        shadow = QGraphicsDropShadowEffect(card)
        shadow.setBlurRadius(36); shadow.setOffset(0, 10); shadow.setColor(QColor(20, 20, 20, 32)); card.setGraphicsEffect(shadow)
        layout = QVBoxLayout(card)
        layout.setContentsMargins(42, 36, 42, 36); layout.setSpacing(14)
        logo = QLabel("READJI", card); logo.setAlignment(Qt.AlignCenter); logo.setStyleSheet("color: #7c3aed; font-size: 34px; font-weight: 800; letter-spacing: 4px;")
        layout.addWidget(logo)
        divider = QFrame(card); divider.setFrameShape(QFrame.HLine); divider.setStyleSheet("color: #e8e7e3;"); layout.addWidget(divider)
        heading = SubtitleLabel("เข้าสู่ระบบ Readji TTS Agent", card); heading.setAlignment(Qt.AlignCenter); layout.addWidget(heading)
        hint = BodyLabel("ใช้บัญชี writer เดียวกับเว็บไซต์\nรหัสผ่านจะไม่ถูกบันทึกในแอป", card); hint.setAlignment(Qt.AlignCenter); hint.setStyleSheet("color: #71717a;"); layout.addWidget(hint)
        self.email = LineEdit(card); self.email.setPlaceholderText("อีเมล"); self.email.setClearButtonEnabled(True)
        self.password = PasswordLineEdit(card); self.password.setPlaceholderText("รหัสผ่าน")
        self.login_button = PrimaryPushButton("เข้าสู่ระบบ", card); self.login_button.setMinimumHeight(46)
        self.login_button.clicked.connect(self._login); self.password.returnPressed.connect(self._login)
        for widget in (self.email, self.password, self.login_button): layout.addWidget(widget)
        outer.addWidget(card, 0, Qt.AlignHCenter); outer.addStretch(1)

    def _login(self) -> None:
        if self.login_thread is not None:
            return
        if not self.email.text().strip() or not self.password.text():
            InfoBar.warning("ข้อมูลไม่ครบ", "กรุณากรอกอีเมลและรหัสผ่าน", parent=self, position=InfoBarPosition.TOP); return
        self.login_button.setEnabled(False)
        self.login_button.setText("กำลังเข้าสู่ระบบ...")
        self.email.setEnabled(False)
        self.password.setEnabled(False)
        self.login_thread = LoginThread(self.email.text().strip(), self.password.text())
        self.login_thread.succeeded.connect(self._login_succeeded)
        self.login_thread.failed.connect(self._login_failed)
        self.login_thread.finished.connect(self._finish_login)
        self.login_thread.start()

    def _login_succeeded(self, client: ApiClient, refresh_token: str, display_name: str) -> None:
        save_refresh_token(refresh_token)
        self.password.clear()
        self.signed_in.emit(client, display_name)

    def _login_failed(self, message: str) -> None:
        InfoBar.error("เข้าสู่ระบบไม่สำเร็จ", message, parent=self, position=InfoBarPosition.TOP)

    def _finish_login(self) -> None:
        if self.login_thread is not None:
            self.login_thread.deleteLater()
        self.login_thread = None
        self.email.setEnabled(True)
        self.password.setEnabled(True)
        self.login_button.setEnabled(True)
        self.login_button.setText("เข้าสู่ระบบ")


class RenderThread(QThread):
    started_job = Signal(str, str, str, str); progress = Signal(int, int, float); succeeded = Signal(str); failed = Signal(str); cancelled = Signal(); idle = Signal()
    def __init__(self, client: ApiClient, worker_id: str, renderer: VoxCpmRenderer) -> None:
        super().__init__(); self.client = client; self.worker_id = worker_id; self.renderer = renderer; self.started_at = 0.0; self.cancel_requested = Event()
        self.job_id: str | None = None
        self.last_status_poll = 0.0

    def request_cancel(self) -> None:
        self.cancel_requested.set()

    def _raise_if_cancelled(self) -> None:
        if self.cancel_requested.is_set():
            raise RenderCancelled()
        now = time.monotonic()
        if self.job_id and now - self.last_status_poll >= JOB_STATUS_POLL_SECONDS:
            self.last_status_poll = now
            if self.client.job_status(self.job_id) == TTS_JOB_STATUS["CANCELLED"]:
                self.cancel_requested.set()
                raise RenderCancelled()

    def run(self) -> None:
        job = None
        try:
            # Fail before claiming a queued job or spending GPU time.
            verify_ffmpeg()
            job = self.client.claim_job(self.worker_id)
            if job is None: self.idle.emit(); return
            self.job_id = job["id"]
            self._raise_if_cancelled()
            self.started_at = time.monotonic()
            self.started_job.emit(job["chapter_id"], f"{job['story_title']} — {job['chapter_title']}", job["id"], job["voice_slot"])
            output, duration = self.renderer.render(
                job["text"], job["voice_slot"],
                lambda done, total: self._progress(job["id"], done, total),
                check_cancel=self._raise_if_cancelled,
            )
            self._raise_if_cancelled()
            upload = self.client.upload_url(job["id"], self.worker_id)
            response = httpx.put(upload["upload_url"], content=output.read_bytes(), headers={"Content-Type": "audio/mpeg"}, timeout=120); response.raise_for_status()
            self._raise_if_cancelled()
            self.client.complete_job(job["id"], self.worker_id, duration); self.succeeded.emit("สร้างและอัปโหลดเสียงเรียบร้อย")
        except RenderCancelled:
            if job:
                try: self.client.cancel_job(job["id"], self.worker_id)
                except Exception as error:
                    self.failed.emit(f"หยุดประมวลผลแล้ว แต่บันทึกสถานะยกเลิกไม่สำเร็จ: {error}")
                    return
            self.cancelled.emit()
        except Exception as error:
            message = f"{type(error).__name__}: {error}"
            if job:
                # Bulk cancellation can race with progress/upload/complete.
                # Never try to turn a server-cancelled job into a failed job.
                try:
                    if self.client.job_status(job["id"]) == TTS_JOB_STATUS["CANCELLED"]:
                        self.cancelled.emit()
                        return
                except (ApiError, httpx.HTTPError):
                    pass
                try: self.client.fail_job(job["id"], self.worker_id, message)
                except Exception as status_error:
                    message += f" | บันทึกสถานะงานไม่สำเร็จ: {status_error}"
            self.failed.emit(message)
    def _progress(self, job_id: str, done: int, total: int) -> None:
        self._raise_if_cancelled()
        if done % PROGRESS_REPORT_INTERVAL == 0 or done == total:
            self.client.update_progress(job_id, self.worker_id, done, total)
        elapsed = time.monotonic() - self.started_at
        remaining = (elapsed / done) * (total - done) if done else 0.0
        self.progress.emit(done, total, remaining)


class LogoutThread(QThread):
    completed = Signal()

    def run(self) -> None:
        clear_refresh_token()
        self.completed.emit()


class RenderCancelled(RuntimeError):
    pass


class CancelAllJobsThread(QThread):
    def __init__(self, client: ApiClient) -> None:
        super().__init__()
        self.client = client
        self.error_message: str | None = None

    def run(self) -> None:
        try:
            self.client.cancel_all_jobs()
        except Exception as error:
            self.error_message = str(error)


class QueueJobThread(QThread):
    def __init__(self, client: ApiClient, chapter: dict, voice: str, parent: QWidget) -> None:
        super().__init__(parent)
        self.client = client
        self.chapter_id = chapter["chapter_id"]
        self.voice = voice
        self.previous = {key: chapter.get(key) for key in (
            "latest_job_status", "latest_job_id", "latest_voice_slot", "latest_progress",
        )}
        self.result: dict | None = None
        self.error_message: str | None = None

    def run(self) -> None:
        try:
            self.result = self.client.queue_job(self.chapter_id, self.voice)
        except Exception as error:
            self.error_message = str(error)


class JobsPage(QWidget):
    signed_out = Signal()
    logout_started = Signal()
    shutdown_complete = Signal()
    def __init__(self, settings: QSettings) -> None:
        super().__init__(); self.client: ApiClient | None = None; self.worker_id = settings.value("worker_id", "") or str(uuid.uuid4()); settings.setValue("worker_id", self.worker_id); self.thread: RenderThread | None = None; self.logout_thread: LogoutThread | None = None; self.model_download_dialog: ModelDownloadDialog | None = None; self.renderer: VoxCpmRenderer | None = None; self.preload_thread: ModelPreloadThread | None = None; self.model_ready = False; self.rendering_chapter_id: str | None = None; self.shutdown_requested = False
        self.page = 1
        self.total_pages = 0
        self.rendering_job_id: str | None = None
        self.rendering_progress = 0
        self.cancel_all_thread: CancelAllJobsThread | None = None
        self.cancelling_all = False
        self.queue_threads: dict[str, QueueJobThread] = {}
        self.ffmpeg_ready = False
        self.ffmpeg_setup_dialog: FFmpegSetupDialog | None = None
        layout = QVBoxLayout(self); layout.setContentsMargins(24, 24, 24, 24)
        row = QHBoxLayout(); self.title = SubtitleLabel("ตอนของฉัน"); self.refresh_button = PushButton("รีเฟรช"); self.render_button = PrimaryPushButton("เริ่มประมวลผลงานถัดไป")
        self.refresh_button.clicked.connect(self.refresh_catalog); self.render_button.clicked.connect(self.render_next)
        row.addWidget(self.title); row.addStretch(1)
        for button in (self.refresh_button, self.render_button): row.addWidget(button)
        layout.addLayout(row)
        filters = QHBoxLayout()
        filters.addWidget(BodyLabel("เรื่อง", self))
        self.story_filter = ComboBox(self)
        self.story_filter.setMinimumWidth(240)
        self.story_filter.addItem("เลือกเรื่องก่อนแสดงตอน", userData=None)
        self.story_filter.currentIndexChanged.connect(self._story_changed)
        filters.addWidget(self.story_filter, 1)
        filters.addWidget(BodyLabel("เฉพาะตอนที่ยังไม่มีเสียง", self))
        self.cancel_all_button = PushButton("ยกเลิกงานทั้งหมด", self)
        self.cancel_all_button.clicked.connect(self.cancel_all_jobs)
        filters.addWidget(self.cancel_all_button)
        layout.addLayout(filters)
        self.table = TableView(self); self.chapters_model = ChaptersTableModel(self.table); self.table_delegate = ChapterTableDelegate(self.table); self.table.setModel(self.chapters_model); self.table.setItemDelegate(self.table_delegate); self.table_delegate.action_clicked.connect(self.queue)
        self.table.setShowGrid(False); self.table.setAlternatingRowColors(True); self.table.verticalHeader().setVisible(False); self.table.verticalHeader().setDefaultSectionSize(58)
        self.table.horizontalHeader().setDefaultAlignment(Qt.AlignVCenter | Qt.AlignLeft)
        for column in range(self.chapters_model.columnCount()): self.table.horizontalHeader().setSectionResizeMode(column, QHeaderView.Fixed)
        self.table.setCheckedColor("#f3e8ff", "#4c1d95")
        self.table.setStyleSheet("QTableView { background: #ffffff; border: 1px solid #e8e7e3; border-radius: 16px; alternate-background-color: #fcfcfb; } QHeaderView::section { background: #f7f7f5; color: #71717a; border: none; border-bottom: 1px solid #e8e7e3; font-weight: 600; padding: 12px; }")
        layout.addWidget(self.table, 1)
        pagination = QHBoxLayout()
        self.page_label = BodyLabel("กรุณาเลือกเรื่อง", self)
        self.previous_button = PushButton("ก่อนหน้า", self)
        self.next_button = PushButton("ถัดไป", self)
        self.previous_button.clicked.connect(lambda: self._change_page(-1))
        self.next_button.clicked.connect(lambda: self._change_page(1))
        pagination.addWidget(self.page_label)
        pagination.addStretch(1)
        pagination.addWidget(self.previous_button)
        pagination.addWidget(self.next_button)
        layout.addLayout(pagination)
        self._update_pagination(0)
        self.progress = ProgressBar(self); self.status = BodyLabel("กำลังรอเตรียมโมเดลเสียง"); layout.addWidget(self.progress); layout.addWidget(self.status)

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self._resize_table_columns()

    def _resize_table_columns(self) -> None:
        available = max(self.table.viewport().width(), 1)
        proportions = (0.22, 0.25, 0.08, 0.16, 0.14, 0.15)
        widths = [int(available * proportion) for proportion in proportions]
        widths[-1] += available - sum(widths)
        for column, width in enumerate(widths):
            self.table.setColumnWidth(column, width)

    def set_renderer(self, renderer: VoxCpmRenderer) -> None:
        self.renderer = renderer

    def preload_model(self) -> None:
        if self.shutdown_requested or not self.renderer or self.preload_thread is not None:
            return
        if not is_voxcpm_model_cached():
            self.render_button.setEnabled(False)
            self.status.setText("กำลังดาวน์โหลด VoxCPM2 เพื่อเตรียมใช้งานครั้งแรก...")
            self.model_download_dialog = ModelDownloadDialog(self)
            self.model_download_dialog.ready.connect(self.preload_model)
            self.model_download_dialog.finished.connect(self._model_download_finished)
            self.model_download_dialog.start()
            return
        self.model_ready = False
        self.render_button.setEnabled(False)
        mode = " และ compile ครั้งแรกอาจใช้เวลาหลายนาที" if self.renderer.compile_enabled else ""
        self.status.setText(f"กำลังโหลด VoxCPM2 ใน process แยก{mode}...")
        self.preload_thread = ModelPreloadThread(self.renderer)
        self.preload_thread.finished.connect(self._model_preload_finished)
        self.preload_thread.start()

    def _model_preload_finished(self) -> None:
        thread = self.preload_thread
        if thread is None:
            return
        message = thread.error_message
        self.preload_thread = None
        thread.deleteLater()
        if self.shutdown_requested:
            return
        if message is not None:
            self._model_preload_failed(message)
        else:
            self._model_preloaded()

    def _model_preloaded(self) -> None:
        self.model_ready = True
        self.render_button.setEnabled(not self.cancelling_all)
        self.status.setText("VoxCPM2 พร้อมใช้งานบน GPU ใน process แยก")

    def _model_preload_failed(self, message: str) -> None:
        self.model_ready = False
        self.render_button.setEnabled(not self.cancelling_all)
        self.status.setText("เตรียมโมเดลเสียงไม่สำเร็จ")
        InfoBar.error("โหลด VoxCPM2 ไม่สำเร็จ", message, parent=self, position=InfoBarPosition.TOP)
    def set_client(self, client: ApiClient, name: str) -> None:
        self.client = client
        self.chapters_model.selected_voices.clear()
        self.title.setText("ตอนที่ยังไม่มีเสียง")
        self.story_filter.blockSignals(True)
        self.story_filter.clear()
        self.story_filter.addItem("เลือกเรื่องก่อนแสดงตอน", userData=None)
        self.story_filter.blockSignals(False)
        self.page = 1
        self.total_pages = 0
        self.chapters_model.replace([])
        self._update_pagination(0)
        self.refresh_catalog()

    def refresh_catalog(self) -> None:
        if not self.client: return
        selected = self.story_filter.currentData()
        try:
            stories = self.client.list_stories()
            self.story_filter.blockSignals(True)
            self.story_filter.clear()
            self.story_filter.addItem("เลือกเรื่องก่อนแสดงตอน", userData=None)
            for story in stories:
                self.story_filter.addItem(story["title"], userData=story["id"])
            index = self.story_filter.findData(selected) if selected else -1
            self.story_filter.setCurrentIndex(index if index > 0 else (1 if stories else 0))
            self.story_filter.blockSignals(False)
            if self.story_filter.currentData() != selected:
                self.page = 1
            self.load_chapters()
        except (ApiError, httpx.HTTPError) as error:
            InfoBar.error("โหลดรายชื่อเรื่องไม่สำเร็จ", str(error), parent=self, position=InfoBarPosition.TOP)

    def _story_changed(self, _index: int) -> None:
        self.page = 1
        self.load_chapters()

    def _change_page(self, delta: int) -> None:
        target = self.page + delta
        if 1 <= target <= self.total_pages:
            self.page = target
            self.load_chapters()

    def _update_pagination(self, total: int) -> None:
        self.previous_button.setEnabled(self.page > 1 and self.total_pages > 0)
        self.next_button.setEnabled(self.page < self.total_pages)
        if not self.story_filter.currentData():
            self.page_label.setText("กรุณาเลือกเรื่องก่อนแสดงตอน")
        elif not total:
            self.page_label.setText("ไม่มีตอนที่ยังไม่มีเสียงในเรื่องนี้")
        else:
            self.page_label.setText(f"หน้า {self.page}/{self.total_pages} · {total:,} ตอน · หน้าละ {CHAPTER_PAGE_SIZE} ตอน")

    def load_chapters(self) -> None:
        if not self.client: return
        self.chapters_model.replace([])
        story_id = self.story_filter.currentData()
        if not story_id:
            self.total_pages = 0
            self._update_pagination(0)
            return
        try:
            result = self.client.list_chapters(story_id, self.page, CHAPTER_PAGE_SIZE)
            self.total_pages = result["pagination"]["total_pages"]
            if self.page > max(1, self.total_pages):
                self.page = max(1, self.total_pages)
                result = self.client.list_chapters(story_id, self.page, CHAPTER_PAGE_SIZE)
            self.total_pages = result["pagination"]["total_pages"]
            for item in result["items"]:
                if (item.get("latest_job_id") == self.rendering_job_id
                        and item.get("latest_job_status") == TTS_JOB_STATUS["PROCESSING"]):
                    item["latest_progress"] = max(item.get("latest_progress") or 0, self.rendering_progress)
                pending = self.queue_threads.get(item["chapter_id"])
                if pending and item.get("latest_job_id") == pending.previous["latest_job_id"]:
                    item.update({"latest_job_status": TTS_JOB_STATUS["QUEUED"],
                                 "latest_voice_slot": pending.voice, "latest_progress": 0, "_queue_pending": True})
            self.chapters_model.replace(result["items"])
            self._update_pagination(result["pagination"]["total"])
            self._resize_table_columns()
            for row in range(self.chapters_model.rowCount()):
                index = self.chapters_model.index(row, TABLE_COLUMN["VOICE"])
                if self.chapters_model.flags(index) & Qt.ItemFlag.ItemIsEditable:
                    self.table.openPersistentEditor(index)
            QTimer.singleShot(0, self._resize_table_columns)
            self.table.viewport().update()
        except (ApiError, httpx.HTTPError) as error:
            self.total_pages = 0
            self._update_pagination(0)
            self.page_label.setText("โหลดรายการไม่สำเร็จ กรุณากดรีเฟรช")
            InfoBar.error("โหลดรายการไม่สำเร็จ", str(error), parent=self, position=InfoBarPosition.TOP)
    def queue(self, chapter_id: str) -> None:
        if not self.client or self.cancelling_all or self.shutdown_requested or self.logout_thread is not None or chapter_id in self.queue_threads: return
        chapter = next((item for item in self.chapters_model.chapters if item["chapter_id"] == chapter_id), None)
        if chapter is None or chapter.get("latest_job_status") in (TTS_JOB_STATUS["QUEUED"], TTS_JOB_STATUS["PROCESSING"]):
            return
        voice = self.chapters_model.voice_for(chapter)
        thread = QueueJobThread(self.client, chapter, voice, self)
        self.queue_threads[chapter_id] = thread
        self.chapters_model.selected_voices[chapter_id] = voice
        row = next(row for row, item in enumerate(self.chapters_model.chapters) if item["chapter_id"] == chapter_id)
        self.table.closePersistentEditor(self.chapters_model.index(row, TABLE_COLUMN["VOICE"]))
        self.chapters_model.update_chapter(chapter_id, {
            "latest_job_status": TTS_JOB_STATUS["QUEUED"], "latest_voice_slot": voice,
            "latest_progress": 0, "_queue_pending": True,
        })
        thread.finished.connect(self._queue_job_finished)
        thread.start()

    def _queue_job_finished(self) -> None:
        thread = self.sender()
        if not isinstance(thread, QueueJobThread):
            return
        chapter_id = thread.chapter_id
        self.queue_threads.pop(chapter_id, None)
        chapter = next((item for item in self.chapters_model.chapters if item["chapter_id"] == chapter_id), None)
        if thread.error_message:
            if chapter and chapter.get("_queue_pending"):
                row = self.chapters_model.update_chapter(chapter_id, {**thread.previous, "_queue_pending": False})
                if row is not None:
                    self.table.openPersistentEditor(self.chapters_model.index(row, TABLE_COLUMN["VOICE"]))
            if not self.shutdown_requested:
                InfoBar.error("เพิ่มงานไม่สำเร็จ", f"คืนสถานะแถวแล้ว: {thread.error_message}", parent=self, position=InfoBarPosition.TOP)
        elif thread.result is not None:
            # A refresh may already show a more recent processing/done state.
            if chapter and chapter.get("_queue_pending"):
                self.chapters_model.update_chapter(chapter_id, {
                    "latest_job_status": thread.result["status"], "latest_job_id": thread.result["id"],
                    "latest_voice_slot": thread.result["voice_slot"], "_queue_pending": False,
                })
            self.chapters_model.selected_voices.pop(chapter_id, None)
            if not self.shutdown_requested and not self.cancelling_all:
                InfoBar.success("เพิ่มเข้าคิวแล้ว", f"เสียง{VOICE_LABELS[thread.voice]}", parent=self, position=InfoBarPosition.TOP)
        thread.deleteLater()
        if self.cancelling_all and not self.queue_threads and self.cancel_all_thread is None:
            self._start_cancel_all_request()
    def render_next(self) -> None:
        if self.shutdown_requested or self.cancelling_all or not self.client or (self.thread and self.thread.isRunning()): return
        if self.queue_threads:
            self._notice("กำลังส่งคิว", "กรุณารอให้ API ยืนยันคิวก่อนเริ่มประมวลผล")
            return
        if not self.ffmpeg_ready:
            if self.ffmpeg_setup_dialog is not None and self.ffmpeg_setup_dialog.isVisible():
                self.ffmpeg_setup_dialog.raise_()
                return
            self.render_button.setEnabled(False)
            if self.ffmpeg_setup_dialog is not None:
                self.ffmpeg_setup_dialog.deleteLater()
            self.ffmpeg_setup_dialog = FFmpegSetupDialog(self.window())
            self.ffmpeg_setup_dialog.ready.connect(self._ffmpeg_ready)
            self.ffmpeg_setup_dialog.finished.connect(self._ffmpeg_setup_finished)
            self.ffmpeg_setup_dialog.start()
            return
        if not self.model_ready or not self.renderer or not self.renderer.is_ready:
            self.preload_model()
            self._notice("กำลังเตรียมโมเดลเสียง", "กรุณารอให้โมเดลพร้อม แล้วกดเริ่มงานอีกครั้ง")
            return
        self._begin_render()

    def _ffmpeg_ready(self) -> None:
        self.ffmpeg_ready = True
        self.render_next()

    def _ffmpeg_setup_finished(self) -> None:
        self.render_button.setEnabled(not self.shutdown_requested and not self.cancelling_all)

    def _model_download_finished(self) -> None:
        if not is_voxcpm_model_cached():
            self.render_button.setEnabled(True)

    def _begin_render(self) -> None:
        if self.cancelling_all or not self.client or not self.renderer or (self.thread and self.thread.isRunning()): return
        self.rendering_chapter_id = None
        self.rendering_job_id = None
        self.rendering_progress = 0
        self.thread = RenderThread(self.client, self.worker_id, self.renderer)
        self.thread.started_job.connect(self._started_job); self.thread.progress.connect(self._set_progress)
        self.thread.idle.connect(lambda: self._notice("ไม่มีงานในคิว", "เพิ่มตอนจากตารางก่อนเริ่มประมวลผล")); self.thread.succeeded.connect(lambda msg: self._finished(msg, True)); self.thread.failed.connect(lambda msg: self._finished(msg, False)); self.thread.cancelled.connect(self._render_cancelled)
        self.render_button.setEnabled(False); self.thread.finished.connect(self._render_thread_finished); self.thread.start()
    def _started_job(self, chapter_id: str, title: str, job_id: str, voice: str) -> None:
        self.rendering_chapter_id = chapter_id
        self.rendering_job_id = job_id
        self.rendering_progress = 0
        # This event is emitted only after the API successfully claims the job.
        # Update the existing row on the UI thread without resetting the table.
        for row, chapter in enumerate(self.chapters_model.chapters):
            if chapter["chapter_id"] == chapter_id:
                self.table.closePersistentEditor(self.chapters_model.index(row, TABLE_COLUMN["VOICE"]))
                self.chapters_model.update_chapter(chapter_id, {
                    "latest_job_id": job_id,
                    "latest_job_status": TTS_JOB_STATUS["PROCESSING"],
                    "latest_voice_slot": voice,
                    "latest_progress": 0,
                    "_queue_pending": False,
                })
                break
        self.status.setText(f"กำลังสร้างเสียง: {title} | กำลังคำนวณเวลาโดยประมาณ...")

    @staticmethod
    def _format_duration(seconds: float) -> str:
        rounded = max(0, round(seconds))
        minutes, seconds = divmod(rounded, 60)
        return f"{minutes} นาที {seconds:02d} วินาที" if minutes else f"{seconds} วินาที"

    def _set_progress(self, done: int, total: int, remaining: float) -> None:
        if self.cancelling_all or self.shutdown_requested:
            return
        self.rendering_progress = round(done * 100 / total) if total else 0
        for chapter in self.chapters_model.chapters:
            if (chapter["chapter_id"] == self.rendering_chapter_id
                    and chapter.get("latest_job_id") == self.rendering_job_id
                    and chapter.get("latest_job_status") == TTS_JOB_STATUS["PROCESSING"]):
                self.chapters_model.update_chapter(chapter["chapter_id"], {"latest_progress": self.rendering_progress})
                break
        self.progress.setValue(self.rendering_progress)
        self.status.setText(f"กำลังสร้างเสียง {done}/{total} ช่วง | คาดว่าจะเสร็จใน {self._format_duration(remaining)}")

    def cancel_all_jobs(self) -> None:
        if not self.client or self.cancelling_all:
            return
        dialog = MessageBox(
            "ยกเลิกงานทั้งหมด?",
            "ยกเลิกงานที่รอคิวและกำลังแปลงทั้งหมดของบัญชีนี้ ทุกเรื่องและทุกหน้า\n"
            "รวมถึงงานบน Agent เครื่องอื่น โดยไม่ลบเสียงที่สร้างเสร็จแล้ว",
            self.window(),
        )
        dialog.yesButton.setText("ยืนยันยกเลิกงานทั้งหมด")
        dialog.cancelButton.setText("กลับ")
        if not dialog.exec():
            return
        self.cancelling_all = True
        self.cancel_all_button.setEnabled(False)
        self.cancel_all_button.setText("กำลังยกเลิก...")
        self.render_button.setEnabled(False)
        self.table.setEnabled(False)
        self.status.setText("กำลังหยุดการแปลงและยกเลิกงานทั้งหมด...")
        if self.thread and self.thread.isRunning():
            self.thread.request_cancel()
        if self.queue_threads:
            self.status.setText("กำลังรอคำขอเข้าคิวที่ส่งไปแล้ว ก่อนยกเลิกทั้งหมด...")
            return
        self._start_cancel_all_request()

    def _start_cancel_all_request(self) -> None:
        # Wait for in-flight enqueues, so they cannot recreate jobs after cancel-all.
        self.cancel_all_thread = CancelAllJobsThread(self.client)
        self.cancel_all_thread.finished.connect(self._cancel_all_finished)
        self.cancel_all_thread.start()

    def _cancel_all_finished(self) -> None:
        thread = self.cancel_all_thread
        if thread is None:
            return
        error = thread.error_message
        self.cancel_all_thread = None
        thread.deleteLater()
        if error:
            self.status.setText(f"ยกเลิกงานทั้งหมดไม่สำเร็จ: {error}")
            InfoBar.error("ยกเลิกงานทั้งหมดไม่สำเร็จ", error, parent=self, position=InfoBarPosition.TOP)
        else:
            self.status.setText("ยกเลิกงานในคิวและงานที่กำลังแปลงทั้งหมดแล้ว")
            InfoBar.success("ยกเลิกงานแล้ว", "ไม่ลบเสียงที่สร้างเสร็จแล้ว", parent=self, position=InfoBarPosition.TOP)
        if not self.shutdown_requested:
            self.load_chapters()
        self._finish_cancellation_controls()

    def _finish_cancellation_controls(self) -> None:
        if self.queue_threads or self.cancel_all_thread is not None or (self.thread and self.thread.isRunning()):
            return
        self.cancelling_all = False
        self.cancel_all_button.setText("ยกเลิกงานทั้งหมด")
        self.cancel_all_button.setEnabled(not self.shutdown_requested)
        self.table.setEnabled(not self.shutdown_requested)
        self.render_button.setEnabled(not self.shutdown_requested and self.preload_thread is None)

    def request_shutdown(self) -> bool:
        self.shutdown_requested = True
        if self.ffmpeg_setup_dialog is not None and self.ffmpeg_setup_dialog.thread is not None:
            self.ffmpeg_setup_dialog.thread.cancel_requested.set()
        if self.thread and self.thread.isRunning():
            self.thread.request_cancel()
        if self.renderer is not None:
            self.renderer.request_shutdown()
        if not self.thread or not self.thread.isRunning():
            return False
        self.render_button.setEnabled(False)
        self.status.setText("กำลังยกเลิกงานและบันทึกสถานะก่อนปิดโปรแกรม...")
        return True

    def _render_cancelled(self) -> None:
        self.rendering_job_id = None
        self.rendering_chapter_id = None
        self.progress.setValue(0)
        self.status.setText("ยกเลิกงานแล้ว")
        if not self.shutdown_requested:
            self.load_chapters()

    def _render_thread_finished(self) -> None:
        self.model_ready = self.renderer is not None and self.renderer.is_ready
        self.render_button.setEnabled(not self.shutdown_requested and not self.cancelling_all)
        if self.cancelling_all:
            self._finish_cancellation_controls()
        if self.shutdown_requested:
            self.shutdown_complete.emit()
    def _notice(self, title: str, message: str) -> None: InfoBar.info(title, message, parent=self, position=InfoBarPosition.TOP)
    def _finished(self, message: str, success: bool) -> None:
        self.rendering_job_id = None
        self.rendering_chapter_id = None
        if not success:
            self.ffmpeg_ready = False
        self.progress.setValue(0); self.status.setText("พร้อมทำงาน" if success else message); (InfoBar.success if success else InfoBar.error)("TTS Agent", message, parent=self, position=InfoBarPosition.TOP)
        if not self.shutdown_requested: self.load_chapters()
    def logout(self) -> None:
        if self.queue_threads:
            self._notice("กำลังส่งคิว", "กรุณารอให้คำขอเข้าคิวเสร็จก่อนออกจากระบบ")
            return
        if self.cancelling_all:
            self._notice("กำลังยกเลิกงาน", "กรุณารอให้ยกเลิกงานเสร็จก่อนออกจากระบบ")
            return
        if self.logout_thread and self.logout_thread.isRunning():
            return
        self.logout_started.emit()
        self.logout_thread = LogoutThread()
        self.logout_thread.finished.connect(self._logout_completed)
        self.logout_thread.start()

    def _logout_completed(self) -> None:
        if self.logout_thread is not None:
            self.logout_thread.deleteLater()
        self.logout_thread = None
        self.client = None
        self.signed_out.emit()


class MainWindow(FluentWindow):
    def __init__(self) -> None:
        super().__init__(); self.settings = QSettings("Readji", "TTS Agent"); self.login_page = LoginPage(); self.jobs_page = JobsPage(self.settings)
        voices_root = Path(__file__).resolve().parents[2] / "assets" / "voices"
        self.jobs_page.set_renderer(VoxCpmRenderer(voices_root))
        self.login_page.setObjectName("login-page"); self.jobs_page.setObjectName("jobs-page"); self.addSubInterface(self.login_page, FluentIcon.PEOPLE, "เข้าสู่ระบบ")
        self.login_added = True; self.jobs_added = False; self.logout_navigation_item = None; self.closing_after_render = False; self.navigationInterface.hide(); self.login_page.signed_in.connect(self._signed_in); self.jobs_page.logout_started.connect(self._logout_started); self.jobs_page.signed_out.connect(self._signed_out); self.jobs_page.shutdown_complete.connect(self._finish_shutdown); self.resize(1080, 720); self.jobs_page.preload_model(); self._restore_session()
    def _restore_session(self) -> None:
        token = load_refresh_token()
        if not token: return
        try:
            client = ApiClient(DEFAULT_API_URL); result = client.refresh(token); self._signed_in(client, result["user"]["display_name"])
        except (ApiError, httpx.HTTPError): clear_refresh_token()
    def _signed_in(self, client: ApiClient, name: str) -> None:
        if not self.jobs_added: self.addSubInterface(self.jobs_page, FluentIcon.MUSIC, "งานเสียง"); self.jobs_added = True
        if self.logout_navigation_item is None: self.logout_navigation_item = self.navigationInterface.addItem("logout", FluentIcon.POWER_BUTTON, "ออกจากระบบ", self.jobs_page.logout, selectable=False, position=NavigationItemPosition.BOTTOM)
        if self.login_added: self.removeInterface(self.login_page); self.login_added = False
        self.navigationInterface.show(); self.switchTo(self.jobs_page); self.jobs_page.set_client(client, name)

    def _logout_started(self) -> None:
        if self.logout_navigation_item is not None:
            self.logout_navigation_item.setEnabled(False)
            self.logout_navigation_item.setText("กำลังออกจากระบบ...")

    def _signed_out(self) -> None:
        if not self.login_added:
            self.addSubInterface(self.login_page, FluentIcon.PEOPLE, "เข้าสู่ระบบ")
            self.login_added = True
        self.switchTo(self.login_page)
        if self.logout_navigation_item is not None:
            self.navigationInterface.removeWidget("logout")
            self.logout_navigation_item = None
        if self.jobs_added:
            self.removeInterface(self.jobs_page)
            self.jobs_added = False
        self.navigationInterface.hide()

    def closeEvent(self, event) -> None:
        if not self.closing_after_render:
            self.closing_after_render = True
            self.jobs_page.request_shutdown()
            self.setEnabled(False)
            self.setWindowTitle("กำลังรอให้งานเบื้องหลังหยุดก่อนปิดโปรแกรม...")
            self.shutdown_timer = QTimer(self)
            self.shutdown_timer.setInterval(250)
            self.shutdown_timer.timeout.connect(self._finish_shutdown)
            self.shutdown_timer.start()
        if self._has_running_threads():
            event.ignore()
            return
        self.shutdown_timer.stop()
        if self.jobs_page.renderer is not None:
            self.jobs_page.renderer.close()
        event.accept()

    def _has_running_threads(self) -> bool:
        # Keep the window alive until enqueue completion slots have reconciled
        # state and (if requested) started the subsequent bulk cancellation.
        if self.jobs_page.queue_threads:
            return True
        download_dialog = self.jobs_page.model_download_dialog
        threads = (
            self.login_page.login_thread,
            self.jobs_page.preload_thread,
            self.jobs_page.thread,
            self.jobs_page.logout_thread,
            self.jobs_page.cancel_all_thread,
            self.jobs_page.ffmpeg_setup_dialog.thread if self.jobs_page.ffmpeg_setup_dialog is not None else None,
            download_dialog.thread if download_dialog is not None else None,
        )
        # wait(0) also checks native thread cleanup without blocking the UI.
        return any(thread is not None and not thread.wait(0) for thread in threads)

    def _finish_shutdown(self) -> None:
        if self.closing_after_render and not self._has_running_threads():
            self.close()


def main() -> None:
    if sys.stderr is not None:
        faulthandler.enable()
    app = QApplication(sys.argv); window = MainWindow(); window.show(); sys.exit(app.exec())


if __name__ == "__main__": main()
