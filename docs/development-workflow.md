# 開発ワークフローの GitHub 設定

開発手順の正本は `AGENTS.md` である。この文書は、その手順のうち GitHub が main に対して強制している Ruleset の設定と、2026-11-24 時点で確認した動作を記録する。手順そのものをここで再定義しない。

設定値は 2026-11-24 に `GET /repos/H-ampk/concept-book/rulesets/27953493` を再取得し、この文書と一致することを確認した。

## Ruleset

| 項目 | 値 |
| --- | --- |
| 名前 | Protect main |
| ID | `27953493` |
| Enforcement | `active` |
| 設定画面 | https://github.com/H-ampk/concept-book/rules/27953493 |
| API | `GET /repos/H-ampk/concept-book/rulesets/27953493` |
| 対象 | `refs/heads/main` のみ。exclude は空 |
| bypass | `bypass_actors` は空。`current_user_can_bypass` は `never`。管理者を含む全員が対象 |

## 有効なルール

Pull request を必須にする。

- 承認人数は 0。
- レビュー会話の解決（`required_review_thread_resolution`）は true。未解決スレッドが残ると、承認 0 人でもマージできない、という設定である。この制限が未解決スレッドで実際にマージを止めたことは、まだ動作として確認していない。
- dismiss stale reviews、code owner review、last push approval、unattributed changes への追加承認はすべて false。
- 許可するマージ方式は merge、squash、rebase。リポジトリのマージ設定もこの 3 方式のままである。

必須ステータスチェックは次の 2 つのみ。`strict_required_status_checks_policy` は true なので、ブランチは最新の main を含んでいる必要がある。

| context | 提供元 | integration_id |
| --- | --- | --- |
| `unit` | GitHub Actions。workflow 名 `Test`（`.github/workflows/test.yml`）のジョブ名 | `15368` |
| `e2e` | 同上 | `15368` |

`unit` と `e2e` に path filter は付いていない。必須のままにするジョブへ path filter を足すと、該当パス以外の PR でチェックが Pending のままになりマージできなくなる。

force push は `non_fast_forward` で禁止する。ブランチ削除は `deletion` で禁止する。`update`（restrict updates）と `required_linear_history` は無い。

## 必須チェックに含めないもの

CodeRabbit のチェック名は `CodeRabbit`。conclusion が `NEUTRAL` や `SKIPPED` になり得る。必須成功にすると、レビューが成功扱いにならない PR をマージできなくなる。必須チェックには含めない。レビューを見るかどうかは `AGENTS.md` のマージ条件に従う。

GitHub Pages の workflow 名は `Deploy to GitHub Pages`（`.github/workflows/deploy.yml`）。トリガーは main への push と `workflow_dispatch` だけで、PR では走らない。ジョブ名は `build` と `deploy` で、成果物のアップロードと `actions/deploy-pages` であり、main へ commit を push しない。この 2 つを必須チェックにすると、PR 上では永遠に Pending になりマージできなくなる。含めない。現行の Pages 公開は main へ commit しないため、この Ruleset は公開を止めない。将来、main へ自動 commit する workflow を足す場合は、bypass または別ブランチ運用を別途検討する。

## 確認方法

```text
GET /repos/H-ampk/concept-book/rulesets/27953493
```

設定画面 https://github.com/H-ampk/concept-book/rules/27953493 でも同じ内容を見られる。変更したあとは API で再取得し、この文書の表と差分が無いか確認する。差分を意図して残す場合は、先にこの文書を更新する。

## 変更の承認

Ruleset の作成、ルールの変更、Enforcement の変更、削除は、ユーザーの明示的な承認を得てから行う。変更は設定画面か、同じ ID への API で行う。承認前に変えない。

承認して変更したあとは、変更理由と再取得した設定を対象 Issue または PR に残し、この文書を同じ内容へ更新する。

## 緊急時の解除と復旧

解除は緊急時だけとする。理由を Issue に残してから行う。

無効化は、設定画面で Enforcement を Disabled にするか、次を送る。

```text
PUT /repos/H-ampk/concept-book/rulesets/27953493
{"enforcement":"disabled"}
```

無効化したルール本体は残る。復旧は同じ ID に `{"enforcement":"active"}` を PUT する。PUT のあと再取得し、`require_extra_approval_for_unattributed_changes` が `false` のままか確認する。作成時、リクエストに無いこの値が `true` になったことがあり、承認人数 0 の個人開発ではマージを止め得る。是正後の再取得では `false` である。

削除は `DELETE /repos/H-ampk/concept-book/rulesets/27953493`。削除すると ID `27953493` は戻らない。作り直す場合は、承認済みのルール（この文書の「有効なルール」と「必須チェックに含めないもの」）で `POST /repos/H-ampk/concept-book/rulesets` し、作成直後に unattributed changes の追加承認が `true` になっていないか再取得する。`true` なら `false` に戻す。

## 動作の確認記録（2026-11-24）

確認した事実と、設定の再取得だけで見ている事項を分ける。force push、ブランチ削除、main への直接 push は、記録済みの 1 回以外に再試行しない。

### 動作として確認した

- 必須 CI が未完了のとき、PR #240 は `e2e` の実行中に merge state が `BLOCKED` になった。
- PR #240 が最新 main を含んでいないとき、merge state は `BEHIND` だった。`strict_required_status_checks_policy` が有効な状態での観測である。
- main へ同期し、`unit` と `e2e` が SUCCESS になったあと、同じ PR は `CLEAN` かつ `MERGEABLE` だった。CodeRabbit は `SKIPPED` で、必須チェックではなかった。未解決のレビュースレッドは無かった。承認は 0 人のままマージできた。マージ commit は `7842f5f85b8a1966de80dd1498c0e182e1cb47ff`。
- main への直接 push は Ruleset により拒否された。拒否理由は、pull request 経由が必須であることと、必須ステータスチェックが 2 件であることだった。Ruleset 自体は変更していない。
- 上記マージのあと、GitHub Pages の `build` と `deploy` は success だった。対象 run は https://github.com/H-ampk/concept-book/actions/runs/45328235338 （head `7842f5f85b8a1966de80dd1498c0e182e1cb47ff`）。

### 設定のみ確認し、動作は未確認

- 未解決のレビュー会話が残っている PR を、Ruleset が実際にマージ拒否すること。
- force push の拒否。
- main ブランチ削除の拒否。
