import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'documents.index': { paramsTuple?: []; params?: {} }
    'documents.create': { paramsTuple?: []; params?: {} }
    'documents.store': { paramsTuple?: []; params?: {} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.finalize': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.summary_report': { paramsTuple?: []; params?: {} }
    'documents.document_line_items.store': { paramsTuple: [ParamValue]; params: {'document_id': ParamValue} }
    'documents.document_line_items.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'document_id': ParamValue,'id': ParamValue} }
    'health_check': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'documents.index': { paramsTuple?: []; params?: {} }
    'documents.create': { paramsTuple?: []; params?: {} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.summary_report': { paramsTuple?: []; params?: {} }
    'health_check': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'documents.index': { paramsTuple?: []; params?: {} }
    'documents.create': { paramsTuple?: []; params?: {} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.summary_report': { paramsTuple?: []; params?: {} }
    'health_check': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'documents.store': { paramsTuple?: []; params?: {} }
    'documents.document_line_items.store': { paramsTuple: [ParamValue]; params: {'document_id': ParamValue} }
  }
  PUT: {
    'documents.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'documents.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.finalize': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'documents.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.document_line_items.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'document_id': ParamValue,'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}