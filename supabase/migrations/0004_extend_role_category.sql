-- Extend role_category enum to better cover finance sub-verticals.
-- New values added; old `risk` value retained for back-compat but no longer
-- emitted by the classifier (superseded by `risk_compliance`).

alter type role_category add value if not exists 'risk_compliance';
alter type role_category add value if not exists 'technology';
alter type role_category add value if not exists 'corporate_functions';
