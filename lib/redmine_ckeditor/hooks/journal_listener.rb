module RedmineCkeditor::Hooks
  class JournalListener < Redmine::Hook::ViewListener
    def view_journals_notes_form_after_notes(context)
      return unless RedmineCkeditor.enabled?

      project = context[:project]
      journal = context[:journal]
      javascript_tag <<-EOT
        (function() {
          var note_id = "journal_#{journal.id}_notes";
          CKEDITOR.replace(note_id, #{RedmineCkeditor.options(project).to_json});
          var note = $("#" + note_id);

          var save_button = note.parent().find(":submit");
          var cancel_button = save_button.next().get(0);

          save_button.click(function() {
            var editor = CKEDITOR.instances[note_id];
            note.val(editor.getData());
            editor.destroy();
          });

          var cancel = cancel_button.onclick;
          cancel_button.onclick = function() {
            CKEDITOR.instances[note_id].destroy();
            cancel();
            return false;
          };
        })();
      EOT
    end
  end
end

